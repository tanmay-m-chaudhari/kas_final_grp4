import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import slugify from 'slugify';
import { Category } from '../models/Category';
import { Product } from '../models/Product';

const schema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(1000).optional(),
  parent: Joi.string().optional(),
  imageUrl: Joi.string().uri().optional(),
});

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await Category.find({ isActive: true }).populate('parent', 'name slug').lean();
    res.json(categories);
  } catch (err) { next(err); }
}

export async function getCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await Category.findOne({ slug: req.params.slug }).populate('parent').lean();
    if (!category) return res.status(404).json({ error: 'Category not found' });
    const products = await Product.find({ category: req.params.slug, isActive: true }).limit(20).lean();
    res.json({ ...category, products });
  } catch (err) { next(err); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    value.slug = slugify(value.name, { lower: true, strict: true });
    const category = await Category.create(value);
    res.status(201).json(category);
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ error: 'Category slug already exists' });
    next(err);
  }
}
