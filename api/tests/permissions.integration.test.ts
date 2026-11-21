import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";

process.env.JWT_SECRET = randomBytes(32).toString("hex");
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { signAccessToken } = await import("../src/lib/jwt.js");

test("organization and project permission matrix against PostgreSQL", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const userIds = Array.from({ length: 6 }, () => randomUUID());
  const [admin, orgAdmin, member, outsider, projectManager, inactive] = userIds as [string, string, string, string, string, string];
  const organizationIds: string[] = [];
  const projectIds: string[] = [];
  const signupEmail = `permissions-signup-${randomUUID()}@example.com`;
  const projectBody = { name: "Test project", start_date: "2026-11-20", end_date: "2026-12-20" };
  const memberBody = { user_id: member, project_role: "Engineer", role: "MEMBER" };
  const featureBody = { name: "Test feature", owner_id: member, target_date: "2026-12-10" };

  async function post(path: string, body: unknown, actor?: string, expected = 201) {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(actor && { Authorization: `Bearer ${signAccessToken(actor)}` }) },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    // Record created fixtures before assertions, so failed assertions still allow cleanup.
    if (result.organization?.id) organizationIds.push(result.organization.id);
    if (result.project?.id) projectIds.push(result.project.id);
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
    return result;
  }

  async function patch(path: string, body: unknown, actor?: string, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(actor && { Authorization: `Bearer ${signAccessToken(actor)}` }) },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
    return result;
  }

  try {
    await prisma.users.createMany({
      data: userIds.map((id) => ({
        id, name: "Permissions test", email: `permissions-${id}@example.com`, password: "unused-test-fixture",
        isAdmin: id === admin, isActive: id !== inactive,
      })),
    });

    await t.test("public signup cannot grant global admin", async () => {
      const response = await post("/auth/signup", {
        name: "Unprivileged signup", email: signupEmail, password: "test-password-123", isAdmin: true,
      });
      assert.equal(response.user.isAdmin, false);
      const stored = await prisma.users.findUniqueOrThrow({ where: { email: signupEmail } });
      assert.equal(stored.isAdmin, false);
    });

    const { organization: orgA } = await post("/organizations", { name: "Permissions A" }, admin);
    const { organization: orgB } = await post("/organizations", { name: "Permissions B" }, admin);
    const relationshipId = randomUUID();
    const timestamp = "2026-11-20T10:00:00.000Z";

    await t.test("global admin can populate every organization membership column", async () => {
      const { membership } = await post(`/organizations/${orgA.id}/members`, {
        id: relationshipId, user_id: orgAdmin, role: "Organization owner",
        is_organization_admin: true, created_at: timestamp, organization_id: orgB.id,
      }, admin);
      assert.deepEqual(membership, {
        id: relationshipId, organization_id: orgA.id, user_id: orgAdmin,
        role: "Organization owner", is_organization_admin: true, created_at: timestamp,
      });
    });

    for (const id of [member, projectManager]) {
      await post(`/organizations/${orgA.id}/members`, { user_id: id, role: "Member" }, admin);
    }
    await post(`/organizations/${orgB.id}/members`, {
      user_id: outsider, role: "Other organization admin", is_organization_admin: true,
    }, admin);

    const { project } = await post(`/organizations/${orgA.id}/projects`, projectBody, orgAdmin);
    const { project: otherProject } = await post(`/organizations/${orgB.id}/projects`, projectBody, admin);
    await post(`/projects/${otherProject.id}/members`, {
      user_id: outsider, role: "MEMBER", project_role: "Engineer",
    }, admin);
    const { feature: otherFeature } = await post(`/projects/${otherProject.id}/features`, {
      ...featureBody, owner_id: outsider,
    }, admin);

    await t.test("organization admin can populate every project membership column", async () => {
      const id = randomUUID();
      const { membership } = await post(`/projects/${project.id}/members`, {
        ...memberBody, id, joined_at: timestamp, created_at: timestamp, project_id: otherProject.id,
      }, orgAdmin);
      assert.deepEqual(membership, {
        ...memberBody, id, project_id: project.id, joined_at: timestamp, created_at: timestamp,
      });
    });
    await post(`/projects/${project.id}/members`, {
      user_id: projectManager, role: "PROJECT_MANAGER", project_role: "Project manager",
    }, admin);
    const { feature } = await post(`/projects/${project.id}/features`, featureBody, orgAdmin);
    const milestoneBody = { name: "Delivery", feature_id: feature.id, planned_at: "2026-12-10" };

    const operations: [string, unknown][] = [
      ["/organizations", { name: "Forbidden org" }],
      [`/organizations/${orgA.id}/members`, { user_id: outsider, role: "Member", is_organization_admin: true }],
      [`/organizations/${orgA.id}/projects`, projectBody],
      [`/projects/${project.id}/members`, memberBody],
      [`/projects/${project.id}/features`, featureBody],
      [`/projects/${project.id}/milestones`, milestoneBody],
    ];

    await t.test("all creation endpoints require authentication and an active actor", async () => {
      for (const [path, body] of operations) {
        await post(path, body, undefined, 401);
        await post(path, body, inactive, 403);
        await post(path, body, randomUUID(), 401);
      }
    });

    await t.test("ordinary members, project managers and other-org admins cannot create", async () => {
      for (const actor of [member, projectManager, outsider]) {
        for (const [path, body] of operations) await post(path, body, actor, 403);
      }
    });

    await t.test("organization admins cannot create organizations or grant organization membership", async () => {
      for (const [path, body] of operations.slice(0, 2)) await post(path, body, orgAdmin, 403);
    });

    await t.test("global and scoped organization admins can create project features and milestones", async () => {
      for (const actor of [admin, orgAdmin]) {
        await post(`/organizations/${orgA.id}/projects`, projectBody, actor);
        const { feature: createdFeature } = await post(`/projects/${project.id}/features`, featureBody, actor);
        const { milestone } = await post(`/projects/${project.id}/milestones`, {
          ...milestoneBody, feature_id: createdFeature.id, status: "planned", completed_at: null,
        }, actor);
        assert.equal(milestone.project_id, project.id);
        assert.equal(milestone.feature_id, createdFeature.id);
      }
    });

    await t.test("foreign users, owners and features cannot be attached to another project's records", async () => {
      await post(`/projects/${project.id}/members`, { ...memberBody, user_id: outsider }, orgAdmin, 400);
      await post(`/projects/${project.id}/features`, { ...featureBody, owner_id: orgAdmin }, orgAdmin, 400);
      await post(`/projects/${project.id}/milestones`, { ...milestoneBody, feature_id: otherFeature.id }, admin, 400);
      await post(`/organizations/${orgA.id}/members`, { user_id: randomUUID(), role: "Member" }, admin, 404);
      await post(`/organizations/${randomUUID()}/projects`, projectBody, admin, 404);
      await post(`/projects/${randomUUID()}/features`, featureBody, admin, 404);
      await assert.rejects(prisma.milestones.create({
        data: { name: "Invalid scope", project_id: project.id, feature_id: otherFeature.id, planned_at: new Date() },
      }), (error: any) => error.code === "P2003");
    });

    await t.test("duplicate memberships return 409", async () => {
      await post(`/organizations/${orgA.id}/members`, { user_id: member, role: "Member" }, admin, 409);
      await post(`/projects/${project.id}/members`, memberBody, orgAdmin, 409);
    });

    await t.test("Zod rejects invalid dates, roles, flags and identifiers", async () => {
      await post(`/organizations/${orgA.id}/projects`, { ...projectBody, start_date: "2026-12-30" }, admin, 400);
      await post(`/organizations/${orgA.id}/projects`, { ...projectBody, end_date: "2026-02-30" }, admin, 400);
      await post(`/projects/${project.id}/members`, { ...memberBody, role: "ADMIN" }, admin, 400);
      await post(`/organizations/${orgA.id}/members`, { user_id: member, role: "Member", is_organization_admin: "true" }, admin, 400);
      await post("/projects/not-a-uuid/features", featureBody, admin, 400);
    });

    const { milestone: editableMilestone } = await post(`/projects/${project.id}/milestones`, milestoneBody, admin);
    const editPaths = [
      `/organizations/${orgA.id}`,
      `/projects/${project.id}`,
      `/projects/${project.id}/features/${feature.id}`,
      `/projects/${project.id}/milestones/${editableMilestone.id}`,
    ];

    await t.test("editing requires authentication and the matching administrator scope", async () => {
      for (const path of editPaths) {
        await patch(path, { name: "Forbidden edit" }, undefined, 401);
        await patch(path, { name: "Forbidden edit" }, inactive, 403);
        for (const actor of [member, projectManager, outsider]) {
          await patch(path, { name: "Forbidden edit" }, actor, 403);
        }
      }
      await patch(editPaths[0]!, { name: "Organization admin edit" }, orgAdmin, 403);
      assert.equal((await prisma.organizations.findUniqueOrThrow({ where: { id: orgA.id } })).name, "Permissions A");
      assert.equal((await prisma.projects.findUniqueOrThrow({ where: { id: project.id } })).name, projectBody.name);
    });

    await t.test("global admins edit organizations and managers partially edit projects and content", async () => {
      const { organization } = await patch(editPaths[0]!, { name: " Renamed organization " }, admin);
      assert.equal(organization.name, "Renamed organization");
      for (const actor of [admin, orgAdmin]) {
        const { project: updated } = await patch(editPaths[1]!, { description: "Updated", status: "active" }, actor);
        assert.equal(updated.name, projectBody.name);
        assert.equal(updated.start_date, "2026-11-20T00:00:00.000Z");
        assert.equal(updated.description, "Updated");
        const { feature: updatedFeature } = await patch(editPaths[2]!, { status: "ready", owner_id: projectManager }, actor);
        assert.equal(updatedFeature.owner_id, projectManager);
        assert.equal(updatedFeature.target_date, "2026-12-10T00:00:00.000Z");
        const { milestone } = await patch(editPaths[3]!, { completed_at: "2026-12-11", status: "done" }, actor);
        assert.equal(milestone.completed_at, "2026-12-11T00:00:00.000Z");
        assert.equal(milestone.feature_id, feature.id);
      }
      const { project: cleared } = await patch(editPaths[1]!, { description: null, status: null }, orgAdmin);
      assert.equal(cleared.description, null);
      assert.equal(cleared.status, null);
      const { milestone } = await patch(editPaths[3]!, { completed_at: null }, orgAdmin);
      assert.equal(milestone.completed_at, null);
      assert.equal(milestone.status, "done");
    });

    await t.test("PATCH rejects empty, unknown and immutable fields and validates merged dates", async () => {
      for (const path of editPaths) {
        for (const body of [{}, { id: randomUUID() }, { name: "" }, null, { isAdmin: true }]) {
          await patch(path, body, admin, 400);
        }
      }
      await patch(editPaths[1]!, { organization_id: orgB.id }, admin, 400);
      await patch(editPaths[2]!, { project_id: otherProject.id }, admin, 400);
      await patch(editPaths[3]!, { project_id: otherProject.id }, admin, 400);
      await patch(editPaths[1]!, { start_date: "2026-12-21" }, admin, 400);
      await patch(editPaths[1]!, { end_date: "2026-11-19" }, admin, 400);
      await patch(editPaths[1]!, { start_date: "2026-02-30" }, admin, 400);
      await patch(editPaths[2]!, { owner_id: outsider }, admin, 400);
      await patch(editPaths[3]!, { feature_id: otherFeature.id }, admin, 400);
    });

    await t.test("editing missing resources or children under another project returns 404", async () => {
      await patch(`/organizations/${randomUUID()}`, { name: "Missing" }, admin, 404);
      await patch(`/projects/${randomUUID()}`, { name: "Missing" }, admin, 404);
      await patch(`/projects/${project.id}/features/${otherFeature.id}`, { name: "Wrong parent" }, admin, 404);
      await patch(`/projects/${otherProject.id}/milestones/${editableMilestone.id}`, { name: "Wrong parent" }, admin, 404);
      await patch(`/projects/${project.id}/milestones/${randomUUID()}`, { name: "Missing" }, admin, 404);
    });

    await t.test("PATCH preserves false flags and supports reactivation", async () => {
      for (const [index, wrapper] of [[2, "feature"], [3, "milestone"], [1, "project"]] as const) {
        await patch(editPaths[index]!, { isActive: false }, orgAdmin);
        const renamed = await patch(editPaths[index]!, { name: "Inactive edit" }, orgAdmin);
        assert.equal(renamed[wrapper].isActive, false);
        const active = await patch(editPaths[index]!, { isActive: true }, orgAdmin);
        assert.equal(active[wrapper].isActive, true);
      }
      await patch(editPaths[1]!, { isActive: false }, orgAdmin);
      await patch(editPaths[2]!, { name: "Blocked" }, admin, 409);
      await patch(editPaths[3]!, { name: "Blocked" }, admin, 409);
      await patch(editPaths[1]!, { isActive: true }, orgAdmin);
    });

    await t.test("revoking permissions takes effect with the same JWT", async () => {
      const token = signAccessToken(orgAdmin);
      await prisma.organization_relationships.update({
        where: { id: relationshipId }, data: { is_organization_admin: false },
      });
      const response = await fetch(`${base}/projects/${project.id}/features`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(featureBody),
      });
      assert.equal(response.status, 403);
      await prisma.users.update({ where: { id: admin }, data: { isAdmin: false } });
      await post("/organizations", { name: "Revoked" }, admin, 403);
      await prisma.users.update({ where: { id: admin }, data: { isAdmin: true } });
    });

    await t.test("inactive projects reject new content and membership", async () => {
      await prisma.projects.update({ where: { id: project.id }, data: { isActive: false } });
      for (const [path, body] of operations.slice(3)) await post(path, body, admin, 409);
    });
  } finally {
    try {
      await prisma.milestones.deleteMany({ where: { project_id: { in: projectIds } } });
      await prisma.features.deleteMany({ where: { project_id: { in: projectIds } } });
      await prisma.project_members.deleteMany({ where: { project_id: { in: projectIds } } });
      await prisma.projects.deleteMany({ where: { id: { in: projectIds } } });
      await prisma.organization_relationships.deleteMany({ where: { organization_id: { in: organizationIds } } });
      await prisma.organizations.deleteMany({ where: { id: { in: organizationIds } } });
      await prisma.users.deleteMany({ where: { OR: [{ id: { in: userIds } }, { email: signupEmail }] } });
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});
