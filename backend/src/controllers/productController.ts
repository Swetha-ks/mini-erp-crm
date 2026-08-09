import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";

const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(1),
  category: z.string().optional().nullable(),
  unitPrice: z.number().positive(),
  currentStock: z.number().int().min(0).optional(),
  minStockAlert: z.number().int().min(0).optional(),
  location: z.string().optional().nullable(),
});

export async function createProduct(req: Request, res: Response) {
  try {
    const data = productSchema.parse(req.body);
    const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) return res.status(409).json({ error: "SKU already exists" });
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid input", details: err.errors });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

// Now supports pagination + search (name/sku/category) + low-stock filter
export async function listProducts(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20);
    const q = (req.query.q as string) || "";
    const lowStock = req.query.lowStock === "true";

    const where: any = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [productsRaw, total] = await Promise.all([
      prisma.product.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" } }),
      prisma.product.count({ where }),
    ]);

    // lowStock compares two columns on the same row, which Prisma can't
    // express in `where` directly, so we filter it in JS after fetching.
    const products = lowStock ? productsRaw.filter((p) => p.currentStock <= p.minStockAlert) : productsRaw;

    res.json({
      data: products,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function getProduct(req: Request, res: Response) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      include: { stockMovements: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const data = productSchema.partial().omit({ currentStock: true }).parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id as string }, data });
    res.json(product);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid input", details: err.errors });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function recordStockMovement(req: Request, res: Response) {
  try {
    const { quantity, movementType, reason } = z.object({
      quantity: z.number().int().positive(),
      movementType: z.enum(["IN", "OUT"]),
      reason: z.string().optional(),
    }).parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: req.params.id as string } });
      if (!product) throw new Error("PRODUCT_NOT_FOUND");

      const delta = movementType === "IN" ? quantity : -quantity;
      const newStock = product.currentStock + delta;
      if (newStock < 0) throw new Error("INSUFFICIENT_STOCK");

      const updatedProduct = await tx.product.update({
        where: { id: req.params.id as string },
        data: { currentStock: newStock },
      });
      const movement = await tx.stockMovement.create({
        data: {
          productId: req.params.id as string,
          quantity,
          movementType,
          reason,
          createdById: req.user!.userId,
        },
      });
      return { product: updatedProduct, movement };
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === "PRODUCT_NOT_FOUND") return res.status(404).json({ error: "Product not found" });
    if (err.message === "INSUFFICIENT_STOCK") return res.status(400).json({ error: "Insufficient stock for this movement" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}