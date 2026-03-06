import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import slugify from 'slugify';
import { Product } from '../models/Product';

const createSchema = Joi.object({
  name: Joi.string().min(1).max(300).required(),
  description: Joi.string().min(1).max(5000).required(),
  price: Joi.number().min(0).required(),
  compareAtPrice: Joi.number().min(0).optional(),
  sku: Joi.string().min(1).max(50).required(),
  barcode: Joi.string().optional(),
  category: Joi.string().required(),
  tags: Joi.array().items(Joi.string()).default([]),
  images: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      alt: Joi.string().default(''),
      primary: Joi.boolean().default(false),
    })
  ).default([]),
  inventory: Joi.object({
    quantity: Joi.number().min(0).default(0),
    warehouse: Joi.string().default('main'),
  }).default({}),
  attributes: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
});

const updateSchema = createSchema.fork(
  ['name', 'description', 'price', 'sku', 'category'],
  (s) => s.optional()
);

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, tag, q, minPrice, maxPrice, page = '1', limit = '20', sort = '-createdAt' } = req.query as Record<string, string>;

    const filter: any = { isActive: true };
    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    if (q) filter.$text = { $search: q };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
  } catch (err) { next(err); }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const filter = mongoose.isValidObjectId(req.params.id)
      ? { _id: req.params.id }
      : { slug: req.params.id };
    const product = await Product.findOne(filter).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    value.slug = slugify(value.name, { lower: true, strict: true });
    const product = await Product.create(value);
    res.status(201).json(product);
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ error: 'SKU or slug already exists' });
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (value.name) value.slug = slugify(value.name, { lower: true, strict: true });

    const product = await Product.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function adjustInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const { delta, warehouse } = req.body as { delta: number; warehouse?: string };
    if (typeof delta !== 'number') return res.status(400).json({ error: 'delta must be a number' });

    const update: any = { $inc: { 'inventory.quantity': delta } };
    if (warehouse) update.$set = { 'inventory.warehouse': warehouse };

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.inventory.quantity < 0) {
      await Product.findByIdAndUpdate(req.params.id, { $inc: { 'inventory.quantity': -delta } });
      return res.status(409).json({ error: 'Insufficient inventory' });
    }
    res.json({ inventory: product.inventory });
  } catch (err) { next(err); }
}
