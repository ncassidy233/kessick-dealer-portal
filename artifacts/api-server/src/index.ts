import app from "./app";
import { importOfficialKessickContent } from "./lib/importOfficialKessickContent";
import { logger } from "./lib/logger";
import { repairStaffAddedDealerInvitations } from "./lib/staffDealerProvisioning";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const catalog = await importOfficialKessickContent();
logger.info(catalog, "Official Kessick content catalog ready");
const invitations = await repairStaffAddedDealerInvitations();
logger.info(invitations, "Staff-added dealer preapproval repair complete");

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
