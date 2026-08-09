import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { createProduct, listProducts, getProduct, updateProduct, recordStockMovement } from "../controllers/productController";

const router = Router();
router.use(requireAuth);

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", requireRole("ADMIN", "WAREHOUSE"), createProduct);
router.put("/:id", requireRole("ADMIN", "WAREHOUSE"), updateProduct);
router.post("/:id/stock-movements", requireRole("ADMIN", "WAREHOUSE"), recordStockMovement);

export default router;