import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import { login, me, signup } from "./auth.controller.js";

const authRouter: Router = Router();

authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
authRouter.post("/login", login);
authRouter.post("/signup", signup);
authRouter.get("/me", authenticate, me);

export default authRouter;
