import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "sales", "production", "dispatch"])
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "sales", "production", "dispatch"]).optional()
});

export const createEnquirySchema = z.object({
  enquiry_date: z.string().min(4),
  mode_of_enquiry: z.string().min(1).optional().nullable(),
  company_name: z.string().min(2),
  product: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_of_measurement: z.string().optional().nullable(),
  expected_timeline: z.string().min(2),
  assigned_person: z.string().min(1),
  notes_for_production: z.string().optional().nullable()
});

export const updateEnquirySchema = z.object({
  enquiry_date: z.string().min(4).optional(),
  mode_of_enquiry: z.string().min(1).optional().nullable(),
  company_name: z.string().min(2).optional(),
  product: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unit_of_measurement: z.string().optional().nullable(),
  expected_timeline: z.string().min(2).optional(),
  assigned_person: z.string().min(1).optional(),
  notes_for_production: z.string().optional().nullable()
});

export const updateEnquiryStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "HOLD", "REJECTED"])
});

export const createOrderSchema = z.object({
  enquiry_id: z.number().int().positive().optional().nullable(),
  product: z.string().min(2),
  grade: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.string().min(1),
  packing_type: z.string().min(1),
  packing_size: z.string().min(1),
  delivery_date: z.string().min(4),
  client_name: z.string().min(2),
  address: z.string().min(2).optional().or(z.literal("")),
  city: z.string().min(2).optional(),
  pincode: z.string().min(4).optional(),
  state: z.string().min(2).optional(),
  country_code: z.string().min(2).optional().or(z.literal("")),
  remarks: z.string().optional().nullable()
});

export const updateOrderSchema = z.object({
  product: z.string().min(2).optional(),
  grade: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().min(1).optional(),
  packing_type: z.string().min(1).optional(),
  packing_size: z.string().min(1).optional(),
  delivery_date: z.string().min(4).optional(),
  client_name: z.string().min(2).optional(),
  address: z.string().min(2).optional().or(z.literal("")),
  city: z.string().min(2).optional(),
  pincode: z.string().min(4).optional(),
  state: z.string().min(2).optional(),
  country_code: z.string().min(2).optional().or(z.literal("")),
  remarks: z.string().optional().nullable()
});

export const moveOrderToProductionSchema = z.object({
  status: z.enum(["IN_PRODUCTION"])
});

export const createProductionSchema = z.object({
  order_id: z.number().int().positive(),
  assigned_personnel: z.string().min(2).optional().or(z.literal("")),
  delivery_date: z.string().min(4).optional().or(z.literal("")),
  product_specs: z.string().min(2).optional().or(z.literal("")),
  capacity: z.number().int().positive().optional(),
  particle_size: z.string().min(1).optional().or(z.literal("")),
  acm_rpm: z.number().int().positive().optional(),
  classifier_rpm: z.number().int().positive().optional(),
  blower_rpm: z.number().int().positive().optional(),
  raw_materials: z.string().min(2).optional().or(z.literal("")),
  remarks: z.string().optional().nullable(),
  state: z.string().optional().nullable()
});

export const updateProductionSchema = z.object({
  assigned_personnel: z.string().min(2).optional().or(z.literal("")),
  delivery_date: z.string().min(4).optional().or(z.literal("")),
  product_specs: z.string().min(2).optional().or(z.literal("")),
  capacity: z.number().int().positive().optional(),
  particle_size: z.string().min(1).optional().or(z.literal("")),
  acm_rpm: z.number().int().positive().optional(),
  classifier_rpm: z.number().int().positive().optional(),
  blower_rpm: z.number().int().positive().optional(),
  raw_materials: z.string().min(2).optional().or(z.literal("")),
  remarks: z.string().optional().nullable(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  state: z.string().optional().nullable()
});

export const completeProductionSchema = z.object({
  completion_date: z.string().min(4).optional().nullable()
});

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.");

export const createDispatchSchema = z.object({
  order_id: z.number().int().positive(),
  dispatch_quantity: z.number().int().positive(),
  dispatch_date: dateOnlySchema,
  packing_done: z.boolean(),
  shipment_status: z.enum(["PACKING", "SHIPPED", "DELIVERED"]),
  remarks: z.string().optional().nullable()
});

export const updateDispatchSchema = z.object({
  dispatch_quantity: z.number().int().positive().optional(),
  dispatch_date: dateOnlySchema.optional().nullable(),
  packing_done: z.boolean().optional(),
  shipment_status: z.enum(["PACKING", "SHIPPED", "DELIVERED"]).optional(),
  remarks: z.string().optional().nullable()
});

export const updateOrderExportDateSchema = z.object({
  export_date: z.string().min(4)
});

export const createMasterDataValueSchema = z.object({
  value: z.string().min(1),
  label: z.string().optional().nullable()
});

export const createEnquiryMasterSchema = z.object({
  mode_of_enquiry: z.string().min(1),
  company_name: z.string().min(1),
  product: z.string().min(1),
  assigned_person: z.string().min(1)
});

export const createCustomerMasterSchema = z.object({
  customer_name: z.string().min(1),
  gstn: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  cust_initials: z.string().optional().nullable(),
  s_no_code: z.string().optional().nullable(),
  customer_code: z.string().optional().nullable().or(z.literal("")),
  contact_person: z.string().optional().nullable(),
  contact_person_number: z.string().optional().nullable(),
  company_email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  city: z.string().optional().nullable()
});

export const importCustomerMasterSchema = z.object({
  rows: z.array(createCustomerMasterSchema).min(1)
});
