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
  production: {
    select: ORDER_PRODUCTION_SELECT
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
  state: true,
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
  productionCompletionDate: true,
  createdAt: true,
  updatedAt: true,
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
  production: {
    select: ORDER_PRODUCTION_SELECT
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
