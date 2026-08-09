import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { createChallan, confirmChallan, cancelChallan, listChallans, getChallan } from "../controllers/challanController";

const router = Router();
router.use(requireAuth);

router.get("/", listChallans);
router.get("/:id", getChallan);
router.post("/", requireRole("ADMIN", "SALES"), createChallan);
router.post("/:id/confirm", requireRole("ADMIN", "SALES"), confirmChallan);
router.post("/:id/cancel", requireRole("ADMIN", "SALES"), cancelChallan);

export default router;