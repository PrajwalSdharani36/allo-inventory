import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const [wh1, wh2, wh3] = await Promise.all([
    prisma.warehouse.create({ data: { name: "Mumbai Central", location: "Mumbai, MH" } }),
    prisma.warehouse.create({ data: { name: "Delhi North", location: "New Delhi, DL" } }),
    prisma.warehouse.create({ data: { name: "Bangalore South", location: "Bangalore, KA" } }),
  ]);

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5 Headphones",
        sku: "SONY-WH-XM5",
        description: "Industry-leading noise canceling with Auto NC Optimizer",
        priceInCents: 2999900,
        imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Apple AirPods Pro (2nd Gen)",
        sku: "APPLE-APP-2G",
        description: "Active Noise Cancellation, Adaptive Transparency, Personalized Spatial Audio",
        priceInCents: 2490000,
        imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung Galaxy S24 Ultra",
        sku: "SAMSUNG-S24U",
        description: "200MP camera, S Pen, Titanium frame",
        priceInCents: 12999900,
        imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "MacBook Air M3",
        sku: "APPLE-MBA-M3",
        description: "Apple M3 chip, 15.3-inch Liquid Retina display",
        priceInCents: 13499900,
        imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Logitech MX Master 3S",
        sku: "LOGI-MXM3S",
        description: "8K DPI sensor, quiet clicks, ergonomic design",
        priceInCents: 999900,
        imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400",
      },
    }),
  ]);

  // Stock levels per product per warehouse
  const stockData = [
    // Sony headphones
    { productId: products[0].id, warehouseId: wh1.id, totalUnits: 12, reservedUnits: 0 },
    { productId: products[0].id, warehouseId: wh2.id, totalUnits: 3, reservedUnits: 0 },
    { productId: products[0].id, warehouseId: wh3.id, totalUnits: 1, reservedUnits: 0 },
    // AirPods Pro
    { productId: products[1].id, warehouseId: wh1.id, totalUnits: 8, reservedUnits: 0 },
    { productId: products[1].id, warehouseId: wh2.id, totalUnits: 0, reservedUnits: 0 },
    { productId: products[1].id, warehouseId: wh3.id, totalUnits: 5, reservedUnits: 0 },
    // Samsung S24 Ultra
    { productId: products[2].id, warehouseId: wh1.id, totalUnits: 2, reservedUnits: 0 },
    { productId: products[2].id, warehouseId: wh2.id, totalUnits: 7, reservedUnits: 0 },
    { productId: products[2].id, warehouseId: wh3.id, totalUnits: 4, reservedUnits: 0 },
    // MacBook Air
    { productId: products[3].id, warehouseId: wh1.id, totalUnits: 1, reservedUnits: 0 },
    { productId: products[3].id, warehouseId: wh2.id, totalUnits: 3, reservedUnits: 0 },
    { productId: products[3].id, warehouseId: wh3.id, totalUnits: 0, reservedUnits: 0 },
    // Logitech mouse
    { productId: products[4].id, warehouseId: wh1.id, totalUnits: 20, reservedUnits: 0 },
    { productId: products[4].id, warehouseId: wh2.id, totalUnits: 15, reservedUnits: 0 },
    { productId: products[4].id, warehouseId: wh3.id, totalUnits: 9, reservedUnits: 0 },
  ];

  await prisma.stock.createMany({ data: stockData });

  console.log(`✅ Created ${products.length} products across ${3} warehouses`);
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
