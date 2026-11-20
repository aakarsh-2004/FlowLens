import { app } from "./app.js";
import { config } from "./config/config.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      console.log("Server closing");
      console.log("Disconnecting from database");
      void prisma.$disconnect().then(() => process.exit(0));
    });
  });
}
