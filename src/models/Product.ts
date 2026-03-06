import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  sku: string;
  barcode?: string;
  category: string;
  tags: string[];
  images: { url: string; alt: string; primary: boolean }[];
  inventory: { quantity: number; reserved: number; warehouse: string };
  attributes: Map<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, maxlength: 5000 },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    sku: { type: String, required: true, unique: true, uppercase: true },
    barcode: { type: String },
    category: { type: String, required: true, index: true },
    tags: [{ type: String, lowercase: true }],
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, default: '' },
        primary: { type: Boolean, default: false },
      },
    ],
    inventory: {
      quantity: { type: Number, default: 0, min: 0 },
      reserved: { type: Number, default: 0, min: 0 },
      warehouse: { type: String, default: 'main' },
    },
    attributes: { type: Map, of: String, default: {} },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ price: 1, category: 1 });
productSchema.index({ slug: 1 }, { unique: true });

productSchema.virtual('availableQuantity').get(function (this: IProduct) {
  return this.inventory.quantity - this.inventory.reserved;
});

export const Product: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);
