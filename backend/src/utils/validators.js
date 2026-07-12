import { z } from "zod";
import { normalizeEnquiryProductRows } from "./enquiryProducts.js";

const manualOrderRequestProductsInputSchema = z.preprocess((value) => {
  return normalizeEnquiryProductRows(value);
}, z.array(z.object({
  product: z.string().min(1),
  grade: z.string().min(1, "Grade is required"),
  quantity: z.union([z.string(), z.number()]).optional().nullable(),
  unit_of_measurement: z.string().optional().nullable()
}))).optional();

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

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(6, "New password must be at least 6 characters")
});

const enquiryProductsInputSchema = z.preprocess((value) => {
  return normalizeEnquiryProductRows(value);
}, z.array(z.object({
  product: z.string().min(1),
  grade: z.string().min(1, "Grade is required"),
  quantity: z.union([z.string(), z.number()]).optional().nullable(),
  unit_of_measurement: z.string().optional().nullable()
}))).optional();

const enquiryBaseSchema = z.object({
  enquiry_date: z.string().min(4),
  mode_of_enquiry: z.string().min(1).optional().nullable(),
  company_name: z.string().min(2),
  product: z.string().min(1).optional(),
  products: enquiryProductsInputSchema,
  quantity: z.number().positive().optional(),
  price: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  unit_of_measurement: z.string().optional().nullable(),
  expected_timeline: z.string().min(2),
  assigned_person: z.string().min(1).optional(),
  notes_for_production: z.string().optional().nullable(),
  stage: z.enum(["GENERAL", "SAMPLED", "QUOTED"]).optional(),
  is_urgent: z.boolean().optional()
});

export const createEnquirySchema = enquiryBaseSchema.superRefine((data, ctx) => {
  const products = normalizeEnquiryProductRows(data.products ?? data.product);
  if (products.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["products"],
      message: "Select at least one product."
    });
  }
});

export const updateEnquirySchema = enquiryBaseSchema.partial().superRefine((data, ctx) => {
  if (data.product !== undefined || data.products !== undefined) {
    const products = normalizeEnquiryProductRows(data.products ?? data.product);
    if (products.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["products"],
        message: "Select at least one product."
      });
    }
  }
});

export const updateEnquiryStatusSchema = z
  .object({
    status: z.enum(["ACCEPTED", "REJECTED"]),
    rejection_reason: z.string().trim().min(1).max(190).optional().nullable()
  })
  .superRefine((data, ctx) => {
    // A rejection has to say why — it's the only record of the decision.
    if (data.status === "REJECTED" && !String(data.rejection_reason || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejection_reason"],
        message: "Please give a reason for rejecting this enquiry."
      });
    }
  });

export const createOrderSchema = z.object({
  enquiry_id: z.number().int().positive().optional().nullable(),
  product: z.string().min(2),
  grade: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
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

export const createManualOrderRequestSchema = z.object({
  product: z.string().min(2).optional(),
  products: manualOrderRequestProductsInputSchema,
  grade: z.string().min(1).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  delivery_date: z.string().min(4).optional().or(z.literal("")),
  dispatch_date: z.string().min(4).optional().or(z.literal("")),
  packing_type: z.string().min(1).optional().or(z.literal("")),
  packing_size: z.string().min(1).optional().or(z.literal("")),
  client_name: z.string().min(2),
  address: z.string().min(2).optional().or(z.literal("")),
  city: z.string().min(2).optional(),
  pincode: z.string().min(4).optional(),
  state: z.string().min(2).optional(),
  country_code: z.string().min(2).optional().or(z.literal("")),
  remarks: z.string().optional().nullable()
}).superRefine((data, ctx) => {
  const products = normalizeEnquiryProductRows(data.products ?? data.product);
  if (products.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["products"],
      message: "Select at least one product."
    });
  }

  if (!String(data.delivery_date || data.dispatch_date || "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["delivery_date"],
      message: "Expected timeline is required."
    });
  }
});

export const updateManualOrderRequestStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"])
});

export const setManualOrderRequestDispatchDateSchema = z.object({
  dispatch_date: z.string().min(4)
});

export const updateOrderSchema = z.object({
  product: z.string().min(2).optional(),
  grade: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
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
  produced_quantity: z.number().int().nonnegative().optional(),
  batch_no: z.string().optional().nullable().or(z.literal("")),
  raw_materials: z.string().min(2).optional().or(z.literal("")),
  remarks: z.string().optional().nullable(),
  status: z.enum(["PENDING", "IN_PROGRESS", "HOLD", "COMPLETED"]).optional(),
  state: z.string().optional().nullable()
});

export const completeProductionSchema = z.object({
  completion_date: z.string().min(4).optional().nullable()
});

export const stockAdjustmentSchema = z.object({
  item_id: z.string().min(1),
  quantity: z.number().positive(),
  direction: z.enum(["IN", "OUT"]),
  reason: z.string().min(3)
});

export const inventoryOpeningStockRowSchema = z.object({
  item_id:  z.string().min(1),
  category: z.string().optional().nullable(),
  uom:      z.string().optional().nullable(),
  grade:    z.string().optional().nullable(),
  batch_no: z.string().optional().nullable(),
  quantity: z.number().nonnegative()
});

export const importInventoryOpeningStockSchema = z.object({
  rows: z.array(inventoryOpeningStockRowSchema).min(1)
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

export const createPackingRecordSchema = z.object({
  order_id:                  z.number().int().positive(),
  packed_quantity:           z.number().positive(),
  packing_material_item_id:  z.string().min(1),
  packing_material_qty:      z.number().positive(),
  packed_by:                 z.string().optional().nullable(),
  remarks:                   z.string().optional().nullable()
});

export const updateOrderDispatchDateSchema = z.object({
  dispatch_date: z.string().min(4)
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
  customer_name: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1)),
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

export const createSupplierMasterSchema = z.object({
  supplier_name: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1)),
  gstn: z.string().optional().nullable(),
  pan_no: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  country_code: z.string().optional().nullable(),
  supplier_code: z.string().optional().nullable().or(z.literal("")),
  contact_person: z.string().optional().nullable(),
  contact_person_number: z.string().optional().nullable(),
  company_email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  city: z.string().optional().nullable()
});

export const importSupplierMasterSchema = z.object({
  rows: z.array(createSupplierMasterSchema).min(1)
});

const poItemSchema = z.object({
  item_description: z.string().min(1),
  quantity_ordered: z.number().positive(),
  unit_price: z.number().nonnegative().optional().default(0),
  category: z.string().optional().nullable(),
  uom: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  tax_percent: z.number().nonnegative().max(100).optional().default(0),
  exp_days_delivery: z.string().optional().nullable(),
  batch_no: z.string().optional().nullable(),
  outward_key: z.string().optional().nullable(),
  remark: z.string().max(191).optional().nullable()
});

const poSupplierFields = {
  supplier_email: z.string().email().optional().nullable(),
  supplier_phone: z.string().optional().nullable(),
  supplier_address: z.string().optional().nullable(),
  supplier_pincode: z.string().optional().nullable(),
  supplier_gst_no: z.string().optional().nullable(),
  supplier_pan_no: z.string().optional().nullable()
};

export const createPurchaseOrderSchema = z.object({
  supplier_name: z.string().min(1),
  category: z.string().optional().nullable(),
  po_number_with_category: z.string().optional().nullable(),
  bill_to: z.string().optional().nullable(),
  ship_to: z.string().optional().nullable(),
  order_date: z.string().min(4).optional().nullable(),
  expected_delivery_date: z.string().min(4).optional().nullable(),
  total_discount: z.number().nonnegative().optional().nullable(),
  freight: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  ...poSupplierFields,
  items: z.array(poItemSchema).min(1, "At least one item is required")
});

export const updatePurchaseOrderSchema = z.object({
  supplier_name: z.string().min(1).optional(),
  category: z.string().optional().nullable(),
  po_number_with_category: z.string().optional().nullable(),
  bill_to: z.string().optional().nullable(),
  ship_to: z.string().optional().nullable(),
  order_date: z.string().min(4).optional().nullable(),
  expected_delivery_date: z.string().min(4).optional().nullable(),
  total_discount: z.number().nonnegative().optional().nullable(),
  freight: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  ...poSupplierFields,
  items: z.array(poItemSchema).min(1).optional()
});

export const updatePOStatusSchema = z.object({
  status: z.enum([
    "DRAFT", "SENT_TO_SUPPLIER",
    "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"
  ])
});

export const createGRNSchema = z.object({
  po_id:              z.number().int().positive(),
  received_date:      z.string().min(4).optional().nullable(),
  received_by:        z.string().optional().nullable(),
  vehicle_ref:        z.string().optional().nullable(),
  warehouse_location: z.string().optional().nullable(),
  remarks:            z.string().optional().nullable(),
  items: z.array(z.object({
    po_item_id:        z.number().int().positive(),
    quantity_received: z.number().min(0)
  })).min(1, "At least one item is required")
});

const bomItemSchema = z.object({
  category:    z.enum(["rm", "additives", "catalysts"]),
  name:        z.string().min(1),
  vendor:      z.string().optional().nullable(),
  grade:       z.string().min(1, "Grade is required"),
  qty_per_unit: z.number().positive(),
  remark:      z.string().optional().nullable()
});

export const saveBomSchema = z.object({
  product: z.string().min(1),
  grade:   z.string().min(1),
  items:   z.array(bomItemSchema).min(1, "At least one item is required")
});

export const importBomSchema = z.object({
  rows: z.array(z.object({
    product:      z.string().min(1),
    grade:        z.string().min(1),
    category:     z.enum(["rm", "additives", "catalysts"]),
    name:         z.string().min(1),
    vendor:       z.string().optional().nullable(),
    material_grade: z.string().min(1, "Material grade is required"),
    qty_per_unit: z.number().positive(),
    remark:       z.string().optional().nullable()
  })).min(1, "At least one row is required")
});

export const saveFinishedGoodsTestSheetSchema = z.object({
  product_name:   z.string().optional().nullable(),
  grade:          z.string().optional().nullable(),
  batch_no:       z.string().optional().nullable(),
  overall_result: z.enum(["PENDING", "PASS", "FAIL"]).optional(),
  approved_by:    z.string().optional().nullable(),
  items: z.array(z.object({
    sr_no:          z.number().int().optional().nullable(),
    sample_date:    z.string().min(4).optional().nullable(),
    shift:          z.string().optional().nullable(),
    sampling_by:    z.string().optional().nullable(),
    sampling_time:  z.string().optional().nullable(),
    black_particle: z.string().optional().nullable(),
    bulk_density:   z.string().optional().nullable(),
    sieve_residue:  z.string().optional().nullable(),
    analysis_by:    z.string().optional().nullable(),
    remarks:        z.string().optional().nullable()
  })).min(1, "At least one test row is required")
});

export const saveInProcessTestSheetSchema = z.object({
  product_name: z.string().optional().nullable(),
  grade:        z.string().optional().nullable(),
  batch_no:     z.string().optional().nullable(),
  items: z.array(z.object({
    analysis_date:   z.string().optional().nullable(),
    shift:           z.string().optional().nullable(),
    lot_no:          z.string().optional().nullable(),
    reactor_no:      z.string().optional().nullable(),
    sampling_by:     z.string().optional().nullable(),
    sampling_time:   z.string().optional().nullable(),
    free_fatty_acid: z.string().optional().nullable(),
    ash:             z.string().optional().nullable(),
    moisture:        z.string().optional().nullable(),
    appearance:      z.string().optional().nullable(),
    melting_point:   z.string().optional().nullable(),
    analysis_by:     z.string().optional().nullable(),
    ffa_inform_time: z.string().optional().nullable(),
    remarks:         z.string().optional().nullable()
  })).min(1, "At least one test row is required")
});

export const substituteProductionBatchSchema = z.object({
  section:             z.enum(["rm", "additives", "catalysts"]),
  row_index:           z.number().int().nonnegative(),
  original_item_id:    z.string().min(1),
  original_batch_no:   z.string().min(1),
  quantity:            z.number().int().positive(),
  substitute_item_id:  z.string().min(1),
  substitute_batch_no: z.string().min(1),
  substitute_vendor:   z.string().optional().nullable(),
  substitute_grade:    z.string().optional().nullable(),
  reason:              z.string().optional().nullable()
});

export const saveQcTestSheetSchema = z.object({
  sheet_number:   z.string().optional().nullable(),
  overall_result: z.enum(["PENDING", "PASS", "FAIL"]).optional(),
  approved_by:    z.string().optional().nullable(),
  items: z.array(z.object({
    sr_no:          z.number().int().optional().nullable(),
    sampling_date:  z.string().min(4).optional().nullable(),
    product_name:   z.string().min(1),
    batch_no:       z.string().optional().nullable(),
    mfg_date:       z.string().min(4).optional().nullable(),
    expiry_date:    z.string().min(4).optional().nullable(),
    supplier:       z.string().optional().nullable(),
    sample_qty:     z.number().nonnegative().optional().nullable(),
    test_parameter: z.string().optional().nullable(),
    result:         z.string().optional().nullable(),
    analysis_by:    z.string().optional().nullable(),
    analysis_date:  z.string().min(4).optional().nullable(),
    remarks:        z.string().optional().nullable()
  })).min(1, "At least one test row is required")
});
