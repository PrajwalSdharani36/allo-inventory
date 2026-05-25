import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID required"),
  warehouseId: z.string().min(1, "Warehouse ID required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(10, "Max 10 units per reservation"),
});

export const ReservationIdSchema = z.object({
  id: z.string().min(1, "Reservation ID required"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
