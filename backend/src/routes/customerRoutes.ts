import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { createCustomer, listCustomers, getCustomer, updateCustomer, addFollowUp } from "../controllers/customerController";

const router = Router();

router.use(requireAuth);

router.get("/", listCustomers);
router.get("/:id", getCustomer);
router.post("/", requireRole("ADMIN", "SALES"), createCustomer);
router.put("/:id", requireRole("ADMIN", "SALES"), updateCustomer);
router.post("/:id/follow-ups", requireRole("ADMIN", "SALES"), addFollowUp);

export default router;