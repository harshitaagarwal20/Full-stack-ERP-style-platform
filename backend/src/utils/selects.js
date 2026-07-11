export const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true
};

export const USER_MIN_SELECT = {
  id: true,
  name: true,
  role: true
};

export const BOM_ITEM_SELECT = {
  id:         true,
  category:   true,
  name:       true,
  vendor:     true,
  grade:      true,
  qtyPerUnit: true,
  remark:     true
};

export const BOM_LIST_SELECT = {
  id:        true,
  product:   true,
  grade:     true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { items: true } }
};

export const BOM_DETAIL_SELECT = {
  id:        true,
  product:   true,
  grade:     true,
  createdAt: true,
  updatedAt: true,
  items: { select: BOM_ITEM_SELECT, orderBy: { id: "asc" } }
};

export const ENQUIRY_LIST_SELECT = {
  id: true,
  enquiryNumber: true,
  companyName: true,
  product: true,
  products: true,
  quantity: true,
  price: true,
  currency: true,
  unitOfMeasurement: true,
  enquiryDate: true,
  modeOfEnquiry: true,
  expectedTimeline: true,
  assignedPerson: true,
  notesForProduction: true,
  remarks: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  approvedById: true,
  createdBy: {
    select: USER_MIN_SELECT
  },
  approvedBy: {
    select: USER_MIN_SELECT
  },
  order: {
    select: {
      id: true
    }
  }
};

export const ORDER_DISPATCH_SELECT = {
  id: true,
  dispatchedQuantity: true,
  dispatchDate: true,
  packingDone: true,
  shipmentStatus: true,
  remarks: true
};

export const ORDER_PRODUCTION_SELECT = {
  id: true,
  status: true,
  producedQuantity: true,
  productionCompletionDate: true
};

export const ORDER_LIST_SELECT = {
  id: true,
  salesGroupNumber: true,
  salesOrderNumber: true,
  orderNo: true,
  product: true,
  grade: true,
  quantity: true,
  price: true,
  currency: true,
  unit: true,
  packingType: true,
  packingSize: true,
  deliveryDate: true,
  dispatchDate: true,
  clientName: true,
  address: true,
  city: true,
  pincode: true,
  state: true,
  countryCode: true,
  status: true,
  orderDate: true,
  createdAt: true,
  updatedAt: true,
  remarks: true,
  createdById: true,
  enquiry: {
    select: {
      id: true,
      enquiryNumber: true
    }
  },
  productions: {
    select: ORDER_PRODUCTION_SELECT,
    orderBy: {
      createdAt: "desc"
    }
  },
  dispatches: {
    select: ORDER_DISPATCH_SELECT,
    orderBy: {
      createdAt: "desc"
    }
  }
};

export const MANUAL_ORDER_REQUEST_SELECT = {
  id: true,
  requestNumber: true,
  product: true,
  grade: true,
  quantity: true,
  unit: true,
  packingType: true,
  packingSize: true,
  dispatchDate: true,
  clientName: true,
  address: true,
  city: true,
  pincode: true,
  state: true,
  countryCode: true,
  remarks: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  approvedById: true,
  orderId: true,
  createdBy: {
    select: USER_MIN_SELECT
  },
  approvedBy: {
    select: USER_MIN_SELECT
  },
  order: {
    select: {
      id: true,
      salesGroupNumber: true,
      salesOrderNumber: true,
      orderNo: true,
      price: true,
      currency: true
    }
  }
};

export const PRODUCTION_LIST_SELECT = {
  id: true,
  orderId: true,
  status: true,
  producedQuantity: true,
  state: true,
  batchNo: true,
  assignedPersonnel: true,
  deliveryDate: true,
  productSpecs: true,
  capacity: true,
  particleSize: true,
  acmRpm: true,
  classifierRpm: true,
  blowerRpm: true,
  rawMaterials: true,
  remarks: true,
  productionStartedDate: true,
  productionCompletionDate: true,
  createdAt: true,
  updatedAt: true,
  finishedGoodsTestSheet: {
    select: { overallResult: true, approvedBy: true, approvedAt: true }
  },
  inProcessTestSheet: {
    select: { updatedAt: true, _count: { select: { items: true } } }
  },
  order: {
    select: {
      id: true,
      salesGroupNumber: true,
      salesOrderNumber: true,
      orderNo: true,
      quantity: true,
      price: true,
      currency: true,
      unit: true,
      product: true,
      grade: true,
      packingType: true,
      packingSize: true,
      deliveryDate: true,
      dispatchDate: true,
      clientName: true,
      city: true,
      pincode: true,
      state: true,
      countryCode: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      enquiry: {
        select: {
          id: true,
          enquiryNumber: true,
          companyName: true,
          product: true,
          assignedPerson: true,
          createdAt: true
        }
      },
      dispatches: {
        select: ORDER_DISPATCH_SELECT,
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  }
};

export const FG_TEST_SHEET_ITEM_SELECT = {
  id:            true,
  srNo:          true,
  sampleDate:    true,
  shift:         true,
  samplingBy:    true,
  samplingTime:  true,
  blackParticle: true,
  bulkDensity:   true,
  sieveResidue:  true,
  analysisBy:    true,
  remarks:       true
};

export const FG_TEST_SHEET_SELECT = {
  id:            true,
  productName:   true,
  grade:         true,
  batchNo:       true,
  overallResult: true,
  approvedBy:    true,
  approvedAt:    true,
  createdAt:     true,
  updatedAt:     true,
  items: { select: FG_TEST_SHEET_ITEM_SELECT, orderBy: { id: "asc" } }
};

export const IN_PROCESS_TEST_SHEET_ITEM_SELECT = {
  id:            true,
  analysisDate:  true,
  shift:         true,
  lotNo:         true,
  reactorNo:     true,
  samplingBy:    true,
  samplingTime:  true,
  freeFattyAcid: true,
  ash:           true,
  moisture:      true,
  appearance:    true,
  meltingPoint:  true,
  analysisBy:    true,
  ffaInformTime: true,
  remarks:       true
};

export const IN_PROCESS_TEST_SHEET_SELECT = {
  id:          true,
  productName: true,
  grade:       true,
  batchNo:     true,
  createdAt:   true,
  updatedAt:   true,
  items: { select: IN_PROCESS_TEST_SHEET_ITEM_SELECT, orderBy: { id: "asc" } }
};

export const BATCH_SUBSTITUTION_SELECT = {
  id:                true,
  productionId:      true,
  section:           true,
  originalItemId:    true,
  originalBatchNo:   true,
  originalVendor:    true,
  originalGrade:     true,
  quantity:          true,
  substituteItemId:  true,
  substituteBatchNo: true,
  substituteVendor:  true,
  substituteGrade:   true,
  reason:            true,
  createdAt:         true,
  createdBy: {
    select: { id: true, name: true }
  }
};

export const PRODUCTION_DETAIL_SELECT = {
  ...PRODUCTION_LIST_SELECT,
  batchNo: true,
  finishedGoodsTestSheet: { select: FG_TEST_SHEET_SELECT },
  inProcessTestSheet: { select: IN_PROCESS_TEST_SHEET_SELECT },
  batchSubstitutions: { select: BATCH_SUBSTITUTION_SELECT, orderBy: { createdAt: "desc" } }
};

export const DISPATCH_ORDER_SELECT = {
  id: true,
  salesGroupNumber: true,
  salesOrderNumber: true,
  orderNo: true,
  product: true,
  grade: true,
  quantity: true,
  price: true,
  currency: true,
  unit: true,
  packingType: true,
  packingSize: true,
  deliveryDate: true,
  dispatchDate: true,
  clientName: true,
  city: true,
  pincode: true,
  state: true,
  countryCode: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  enquiry: {
    select: {
      id: true,
      enquiryNumber: true
    }
  },
  productions: {
    select: ORDER_PRODUCTION_SELECT,
    orderBy: {
      createdAt: "desc"
    }
  },
  dispatches: {
    select: ORDER_DISPATCH_SELECT,
    orderBy: {
      createdAt: "desc"
    }
  }
};

export const DISPATCH_LIST_SELECT = {
  id: true,
  orderId: true,
  dispatchedQuantity: true,
  dispatchDate: true,
  packingDone: true,
  shipmentStatus: true,
  remarks: true,
  createdAt: true,
  order: {
    select: DISPATCH_ORDER_SELECT
  }
};

export const PO_ITEM_SELECT = {
  id: true,
  uniqueKey: true,
  itemId: true,
  category: true,
  uom: true,
  grade: true,
  currency: true,
  unitPrice: true,
  taxPercent: true,
  expDaysDelivery: true,
  qty: true,
  receivedQty: true,
  outwardKey: true,
  batchNo: true,
  createdAt: true,
  receivedAt: true
};

export const PO_LIST_SELECT = {
  id: true,
  poNumber: true,
  poNumberWithCategory: true,
  category: true,
  billTo: true,
  shipTo: true,
  orderDate: true,
  expectedDeliveryDate: true,
  totalDiscount: true,
  freight: true,
  status: true,
  totalAmount: true,
  notes: true,
  department: true,
  createdAt: true,
  updatedAt: true,
  supplier: { select: { id: true, name: true } },
  createdBy: { select: USER_MIN_SELECT },
  _count: { select: { items: true, grns: true } }
};

export const PO_DETAIL_SELECT = {
  id: true,
  poNumber: true,
  poNumberWithCategory: true,
  category: true,
  billTo: true,
  shipTo: true,
  orderDate: true,
  expectedDeliveryDate: true,
  totalDiscount: true,
  freight: true,
  status: true,
  totalAmount: true,
  notes: true,
  department: true,
  createdAt: true,
  updatedAt: true,
  supplier: { select: { id: true, name: true, supplierCode: true, contactPerson: true, phone: true, email: true, address: true, pincode: true, gstNo: true, panNo: true } },
  createdBy: { select: USER_MIN_SELECT },
  items: { select: PO_ITEM_SELECT, orderBy: { id: "asc" } },
  grns: { select: { id: true, grnNumber: true, receivedDate: true, status: true, warehouseLocation: true, notes: true, createdAt: true }, orderBy: { createdAt: "desc" } }
};

export const GRN_ITEM_SELECT = {
  id:               true,
  poItemId:         true,
  itemId:           true,
  category:         true,
  grade:            true,
  uom:              true,
  currency:         true,
  unitPrice:        true,
  taxPercent:       true,
  batchNo:          true,
  quantityOrdered:  true,
  quantityReceived: true,
  remarks:          true
};

export const GRN_LIST_SELECT = {
  id:                true,
  grnNumber:         true,
  poId:              true,
  receivedDate:      true,
  status:            true,
  receivedBy:        true,
  warehouseLocation: true,
  createdAt:         true,
  updatedAt:         true,
  purchaseOrder: {
    select: {
      id:       true,
      poNumber: true,
      supplier: { select: { id: true, name: true } }
    }
  },
  _count: { select: { items: true } }
};

export const QC_TEST_SHEET_ITEM_SELECT = {
  id:            true,
  srNo:          true,
  samplingDate:  true,
  productName:   true,
  batchNo:       true,
  mfgDate:       true,
  expiryDate:    true,
  supplier:      true,
  sampleQty:     true,
  testParameter: true,
  result:        true,
  analysisBy:    true,
  analysisDate:  true,
  remarks:       true
};

export const QC_TEST_SHEET_SELECT = {
  id:            true,
  sheetNumber:   true,
  overallResult: true,
  approvedBy:    true,
  approvedAt:    true,
  createdAt:     true,
  updatedAt:     true,
  items: { select: QC_TEST_SHEET_ITEM_SELECT, orderBy: { id: "asc" } }
};

export const GRN_DETAIL_SELECT = {
  id:                true,
  grnNumber:         true,
  poId:              true,
  receivedDate:      true,
  status:            true,
  receivedBy:        true,
  vehicleRef:        true,
  warehouseLocation: true,
  remarks:           true,
  notes:             true,
  createdAt:         true,
  updatedAt:         true,
  purchaseOrder: {
    select: {
      id:       true,
      poNumber: true,
      status:   true,
      supplier: { select: { id: true, name: true } }
    }
  },
  items: { select: GRN_ITEM_SELECT, orderBy: { id: "asc" } },
  qcTestSheet: { select: QC_TEST_SHEET_SELECT }
};

export const AUDIT_LOG_SELECT = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  actorId: true,
  actorName: true,
  actorRole: true,
  oldValue: true,
  newValue: true,
  note: true,
  createdAt: true,
  actor: {
    select: USER_MIN_SELECT
  }
};
