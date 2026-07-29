export type HotelProperty = {
  hotelName: string;
  /** Denormalized single-line for display/compat. */
  address: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostal: string;
  addressCountry: string;
  phoneNumber: string;
  updatedAt: string | null;
  /** True when required structured address fields are present. */
  addressComplete: boolean;
  addressIncompleteFields: string[];
};

export type HotelPropertyInput = {
  hotelName: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostal: string;
  addressCountry: string;
  phoneNumber: string;
};
