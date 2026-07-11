export const SHIP_TO_LOCATIONS = [
  {
    value: "nimbasia-stabilizers-kota",
    label: "Nimbasia Stabilizers - Kota",
    companyName: "NIMBASIA STABILIZERS",
    addressLines: [
      "F-172 A AND B, F-173",
      "INDRAPRASTHA INDUSTRIAL AREA,",
      "ROAD NO-3,",
      "KOTA 324005"
    ],
    district: "Kota",
    stateCodeLabel: "08 - Rajasthan",
    state: "Rajasthan",
    pincode: "324005",
    mobile: "9983306543",
    gstin: "08AAAFN8238K1ZY",
    panNo: "AAAFN8238K"
  },
  {
    value: "nimbasia-stabilizers-bhiwandi",
    label: "Nimbasia Stabilizers - Bhiwandi",
    companyName: "Nimbasia Stabilizers (Bhiwandi)",
    addressLines: [
      "Shree Ganpati Logistics, Ground Floor, Bldg A-10, Gala No 21, Prerna Complex",
      "Opp Vikas Cycle Company, Near Prerna Hotel, Val Village, Bhiwandi, District: Thane,",
      "Maharashtra"
    ],
    district: "Thane",
    stateCodeLabel: "27 - Maharashtra",
    state: "Maharashtra",
    pincode: "421302",
    mobile: "",
    gstin: "27AAAFN8238K3ZW",
    panNo: ""
  },
  {
    value: "nimbasia-polyblends-saykha",
    label: "Nimbasia Polyblends LLP - Saykha",
    companyName: "Nimbasia Polyblends LLP",
    addressLines: [
      "Plot No. DP-35 GIDC Saykha Industrial Estate",
      "Bharuch Gujarat - 392140"
    ],
    district: "Bharuch",
    stateCodeLabel: "24 - Gujarat",
    state: "Gujarat",
    pincode: "392140",
    mobile: "",
    gstin: "24AAUFN2838B1Z9",
    panNo: ""
  },
  {
    value: "nimbasia-stabilizers-khalapur",
    label: "Nimbasia Stabilizers LLP - Khalapur",
    companyName: "Nimbasia Stabilizers LLP",
    addressLines: [
      "Survey No. 7, Hissa No. 3, AT- Kumbhivali,",
      "PO-TAL- Khalapur, Raigad - 410202",
      "Maharashtra"
    ],
    district: "Raigad",
    stateCodeLabel: "27 - Maharashtra",
    state: "Maharashtra",
    pincode: "410202",
    mobile: "",
    gstin: "27AANFN2672A1ZC",
    panNo: ""
  }
];

export const SHIP_TO_OPTIONS = SHIP_TO_LOCATIONS.map((location) => ({
  value: location.value,
  label: location.label
}));

export function getShipToLocation(shipTo) {
  return SHIP_TO_LOCATIONS.find((location) => location.value === shipTo) || SHIP_TO_LOCATIONS[0];
}
