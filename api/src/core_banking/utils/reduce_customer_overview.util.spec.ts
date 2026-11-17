import { CustomerOverview } from '../types/bank_records.type';
import { reduceCustomerOverview } from './reduce_customer_overview.util';

const RILEY_OVERVIEW = {
  customer_id: 'CUS-1007',
  first_name: 'Riley',
  last_name: 'Hughes',
  full_name: 'Riley Hughes',
  mobile_phone: '+61491576801',
  email: 'riley.hughes@example.com',
  suburb: 'Elanora',
  state: 'QLD',
  customer_since: '2020-08-17',
  age: 36,
  tenure_years: 6,
  flags: [],
  has_care_flag: false,
  accounts: [
    {
      account_id: 'ACC-10071',
      product_code: 'EVERYDAY',
      product_name: 'Everyday Account',
      category: 'TRANSACTION',
      nickname: 'Everyday',
      status: 'OPEN',
      role: 'PRIMARY',
      current_balance: 2154.6,
      available_balance: 2116.2,
      daily_transfer_limit: 5000,
    },
  ],
  cards: [
    {
      card_id: 'CRD-10071',
      account_id: 'ACC-10071',
      card_type: 'DEBIT',
      last4: '6142',
      status: 'ACTIVE',
    },
  ],
  preferences: {
    paper_statements: false,
    sms_alerts: true,
    large_print_letters: false,
  },
  recent_contacts: [{ summary: 'Asked about Bali.' }],
} as CustomerOverview;

describe('reduceCustomerOverview (level 1)', () => {
  it('keeps only what a level 1 caller may hear about', () => {
    expect(reduceCustomerOverview(RILEY_OVERVIEW, 1)).toEqual({
      customer_id: 'CUS-1007',
      first_name: 'Riley',
      identity_level: 1,
      is_reduced_view: true,
      accounts: [
        {
          account_id: 'ACC-10071',
          nickname: 'Everyday',
          category: 'TRANSACTION',
          product_name: 'Everyday Account',
        },
      ],
      cards: [
        {
          card_id: 'CRD-10071',
          card_type: 'DEBIT',
          status: 'ACTIVE',
          account_nickname: 'Everyday',
        },
      ],
    });
  });

  it('never carries level 2 answers', () => {
    const reduced_text = JSON.stringify(
      reduceCustomerOverview(RILEY_OVERVIEW, 1),
    );
    expect(reduced_text).not.toMatch(
      /6142|2154|balance|limit|Bali|email|mobile|flags|preferences/,
    );
  });
});
