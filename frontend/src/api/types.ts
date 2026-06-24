export type LookupDto = {
  id: string;
  code: string;
  name: string;
};

export type ReferenceDataDto = {
  brands: LookupDto[];
  categories: LookupDto[];
  units: LookupDto[];
  warehouses: LookupDto[];
};

export type ProductDto = {
  id: string;
  code: string;
  barcode: string;
  name: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitName: string;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  isActive: boolean;
};

export type CustomerDto = {
  id: string;
  code: string;
  name: string;
  phone: string;
};

export type SaleDto = {
  id: string;
  saleNo: string;
  customerName?: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  createdAt: string;
};

export type StockMovementDto = {
  id: string;
  productCode: string;
  productName: string;
  warehouseName: string;
  type: number;
  quantity: number;
  unitPrice: number;
  referenceType: string;
  createdAt: string;
};

export type CurrentStockDto = {
  productCode: string;
  productName: string;
  warehouseName: string;
  quantity: number;
};
