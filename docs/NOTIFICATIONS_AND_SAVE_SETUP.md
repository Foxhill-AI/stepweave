# Notifications and Save-to-Collection Setup

This doc describes the DB changes required for in-app notifications and the "Save to Collection" flow.

## 1. Notifications (like / follow)

Run in **Supabase → SQL Editor**:

- **`scripts/user_notification_table.sql`** – Creates `user_notification` and RLS so users receive "Someone liked your product" and "X started following you".

## 2. Save to Collection (4.1.2)

Run in **Supabase → SQL Editor**:

- **`scripts/product_interaction_add_save.sql`** – Adds `interaction_type = 'save'` to the `product_interaction` check constraint so saves are stored separately from likes.

If the constraint name in your project is different, run:

```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'product_interaction'::regclass
  AND contype = 'c';
```

Then replace `product_interaction_interaction_type_check` in the script with the name you get.

## After running the scripts

- **Like** on a product → creator gets a notification (if they are not the liker).
- **Follow** a creator → they get a "X started following you" notification.
- **Save** on a product → row in `product_interaction` with `interaction_type = 'save'`; **My Collection** (`/collection`) shows saved items. **Unsave** from the collection page works; **Add to cart** links to the product page.
