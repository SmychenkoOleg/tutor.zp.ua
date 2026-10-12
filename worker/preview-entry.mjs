// Cloudflare preview-only entrypoint: authentication runs before HTML, API, and assets.
import siteWorker from "../dist/server/index.js";
import { createPreviewWorker } from "./preview-security.mjs";

export default createPreviewWorker(siteWorker);
