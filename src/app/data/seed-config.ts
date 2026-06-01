import { AppConfig } from '../models';

/** Local default config until Firebase is wired in. */
export const SEED_CONFIG: AppConfig = {
  brandName: "Chloe G's Homemade Treats",
  defaultLeadTimeDays: 3, // order Mon → earliest pickup Thu
  blackoutDates: [],      // admin adds vacation / sold-out days here
  pickupLocation: 'Corporate Lake Properties, 4804 John Garry Dr, Columbia, MO',
  contactEmail: 'hello@chloegstreats.com',
  cottageFoodDisclaimer:
    'This product is prepared in a kitchen not subject to inspection by the Missouri Department of Health and Senior Services.',
};
