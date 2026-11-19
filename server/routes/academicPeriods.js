const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { validateObjectId } = require("../middleware/validateObjectId");
const { validatePeriodBody } = require("../middleware/validators/academicPeriodValidation");
const controller = require("../controller/academicPeriodController");

const router = express.Router();

const validatePeriodId = validateObjectId("id", "Invalid academic period ID");

router.get("/", controller.getPeriods);
router.post("/", requireAdmin, validatePeriodBody, controller.createPeriod);
router.patch("/:id", requireAdmin, validatePeriodId, validatePeriodBody, controller.updatePeriod);
router.delete("/:id", requireAdmin, validatePeriodId, controller.deletePeriod);

module.exports = router;  