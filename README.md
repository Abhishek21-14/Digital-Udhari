# Digital Udhari System with Trust

A complete web-based prototype for local shopkeepers and customers with:

- Single login and role-based mode switch (Shopkeeper / Customer)
- Shopkeeper dashboard for customers, udhari, payments, reports, and guest payment links
- Customer dashboard with read-only transparency for udhari records, payment history, and trust status
- Behavior-based trust score logic (auto-adjusted by udhari/payment events)

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Demo login

- `shop@udhari.in` / `123456` (multi-role)
- `customer@udhari.in` / `123456` (customer)
