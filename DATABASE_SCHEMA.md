# Data Structure Analysis & Supabase Database Schema Proposal

## Current Data Structure Overview

This document analyzes the current data structure used in the project and proposes a Supabase database schema for migration.

---

## 1. Current Data Entities

### 1.1 Item/Product (Main Entity)
**Used in:** `ItemCard`, `ContentSection`, `HeroSection`, `CartPage`, `CartModal`

**Fields:**
```typescript
interface Item {
  id: string                    // Unique identifier (e.g., "Featured-1", "Trending-3")
  title: string                 // Product name (e.g., "Modern Robot Design")
  category: string              // Category slug (e.g., "featured", "trending", "digital")
  image?: string                // Image URL (currently empty strings)
  views?: number                // View count (e.g., 2500)
  likes?: number                // Like count (e.g., 150)
  downloads?: number            // Download count (e.g., 800)
  author?: string               // Creator/author name (e.g., "Sarah Chen")
  price?: string                // Price as string (e.g., "$24.99") - can be undefined for free items
  rating?: number               // Rating (0-5, e.g., 4.8)
  badge?: string                // Badge label (e.g., "Featured", "New Release", "Trending")
}
```

**Additional fields in Cart:**
```typescript
interface CartItem extends Item {
  quantity: number              // Quantity in cart
  type: 'digital' | 'print'     // Product type
  delivery: string              // Delivery method description
}
```

### 1.2 HeroProfile (Creator Profile)
**Used in:** `HeroSection`

**Fields:**
```typescript
interface HeroProfile {
  avatar: string                // Avatar letter/initial (e.g., "K", "FM")
  name: string                  // Profile/creator name (e.g., "Kreations")
  followers: string             // Follower count as string (e.g., "3.5k followers")
  description: string           // Profile description/bio
}
```

**Relationship:** Each profile has multiple associated items (one-to-many)

### 1.3 Cart/CartItem
**Used in:** `CartPage`, `CartModal`

**Fields:**
```typescript
interface CartItem {
  id: string
  title: string
  author: string
  image: string
  price: number                 // Price as number (not string)
  quantity: number
  type: 'digital' | 'print'
  delivery: string
}
```

### 1.4 Advertisement
**Used in:** `AdvertisementCarousel`

**Fields:**
```typescript
interface Advertisement {
  id: string
  title: string
  description?: string
  image: string
  link: string
  cta?: string                  // Call-to-action text
}
```

### 1.5 Categories
**Used in:** `ExploreDropdown`, `Subnavbar`

Currently hardcoded arrays:
- **Browse Links:** Marketplace, For You, Trending, Popular, Paid, Makes, Videos, New Uploads, Downloads, Leagues, Hall of Fame
- **Categories:** 13 categories including "3D Printer Parts & Accessories", "Art & Decor", "Costumes & Cosplay", etc.
- **Trending Searches:** Array of search terms (e.g., "gridfinity", "fidget spinner")
- **Trending Tags:** Array of tag strings

### 1.6 User (Implicit - UI State Only)
Currently managed as UI state:
- `isLoggedIn: boolean`
- `userName: string`
- `userAvatar: string`

No actual user data structure exists - just UI toggle state.

---

## 2. Current Data Source

**Data is NOT coming from JSON files or external APIs.**

### Data Generation Method:
1. **Items are generated programmatically** in `app/page.tsx` using the `generateItems()` function
2. **Random data generation:** Views, likes, downloads, ratings, and prices are generated with `Math.random()`
3. **Hardcoded arrays:** Author names, titles, categories are hardcoded in the code
4. **Cart data:** Exists in `data/cartData.json` but is also duplicated/hardcoded in `CartPage.tsx`
5. **Hero profiles:** Hardcoded arrays in `app/page.tsx`
6. **Categories/Tags:** Hardcoded arrays in `ExploreDropdown.tsx`

### Summary:
- ❌ No database connection
- ❌ No API calls
- ❌ No JSON file imports for items
- ✅ All data is mock/generated at runtime
- ✅ Cart data has a JSON file but isn't actively used

---

## 3. Entity Relationships (Current Structure)

```
HeroProfile (Creator)
    ├── has many → Items (one-to-many)
    
Item (Product)
    ├── belongs to → Category (string-based, no formal relation)
    ├── has one → Author (string name, no formal relation)
    ├── can be in → Cart (many-to-many via cart_items)
    └── has stats → views, likes, downloads, rating

Cart
    ├── has many → CartItems (one-to-many)
    
CartItem
    ├── references → Item (by id)

Advertisement
    └── standalone entity (no relations)

Category/Tags
    └── standalone arrays (no formal structure)
```

---

## 4. Proposed Supabase Database Schema

### 4.1 Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  followers_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile and public profiles
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable" ON users
  FOR SELECT USING (true);
```

### 4.2 Categories Table
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy: Categories are publicly readable
CREATE POLICY "Categories are viewable" ON categories
  FOR SELECT USING (true);
```

### 4.3 Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  price DECIMAL(10, 2),
  is_free BOOLEAN DEFAULT false,
  product_type TEXT CHECK (product_type IN ('digital', 'print')) DEFAULT 'digital',
  image_url TEXT,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0, -- 0.00 to 5.00
  rating_count INTEGER DEFAULT 0,
  badge TEXT CHECK (badge IN ('Featured', 'New Release', 'Trending', 'Popular')),
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_creator ON products(creator_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_views_count ON products(views_count DESC);
CREATE INDEX idx_products_likes_count ON products(likes_count DESC);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Products are viewable when published" ON products
  FOR SELECT USING (status = 'published');

CREATE POLICY "Creators can manage their products" ON products
  FOR ALL USING (auth.uid() = creator_id);
```

### 4.4 Tags Table
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags are viewable" ON tags
  FOR SELECT USING (true);
```

### 4.5 Product Tags (Junction Table)
```sql
CREATE TABLE product_tags (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- Enable RLS
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product tags are viewable" ON product_tags
  FOR SELECT USING (true);
```

### 4.6 Carts Table
```sql
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One cart per user
);

-- Enable RLS
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cart" ON carts
  FOR ALL USING (auth.uid() = user_id);
```

### 4.7 Cart Items Table
```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_added DECIMAL(10, 2) NOT NULL, -- Store price at time of addition
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id) -- One cart item entry per product
);

-- Indexes
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);

-- Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cart items" ON cart_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id  ,
      AND carts.user_id = auth.uid()
    )0
  );
```

### 4.8 Orders Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  shipping_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  payment_method TEXT,
  shipping_address JSONB,
  billing_address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
```

### 4.9 Order Items Table
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL, -- Price at time of purchase
  product_title TEXT NOT NULL, -- Snapshot of product title
  product_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );
```

### 4.10 Advertisements Table
```sql
CREATE TABLE advertisements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  cta_text TEXT,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active advertisements are viewable" ON advertisements
  FOR SELECT USING (is_active = true AND (
    start_date IS NULL OR start_date <= NOW()
  ) AND (
    end_date IS NULL OR end_date >= NOW()
  ));
```

### 4.11 User Interactions (Views, Likes, Downloads)
```sql
CREATE TABLE product_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  interaction_type TEXT CHECK (interaction_type IN ('view', 'like', 'download')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, interaction_type) -- One interaction per type per user/product
);

-- Indexes
CREATE INDEX idx_interactions_user ON product_interactions(user_id);
CREATE INDEX idx_interactions_product ON product_interactions(product_id);
CREATE INDEX idx_interactions_type ON product_interactions(interaction_type);

-- Enable RLS
ALTER TABLE product_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own interactions" ON product_interactions
  FOR ALL USING (auth.uid() = user_id);
```

### 4.12 User Follows (Followers/Following)
```sql
CREATE TABLE user_follows (
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id) -- Prevent self-follow
);

-- Indexes
CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);

-- Enable RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all follows" ON user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON user_follows
  FOR ALL USING (auth.uid() = follower_id);
```

---

## 5. Database Functions & Triggers (Recommended)

### 5.1 Update Product Stats (from interactions)
```sql
-- Function to update product stats based on interactions
CREATE OR REPLACE FUNCTION update_product_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET
    views_count = (SELECT COUNT(*) FROM product_interactions WHERE product_id = NEW.product_id AND interaction_type = 'view'),
    likes_count = (SELECT COUNT(*) FROM product_interactions WHERE product_id = NEW.product_id AND interaction_type = 'like'),
    downloads_count = (SELECT COUNT(*) FROM product_interactions WHERE product_id = NEW.product_id AND interaction_type = 'download')
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trigger_update_product_stats
AFTER INSERT OR DELETE ON product_interactions
FOR EACH ROW
EXECUTE FUNCTION update_product_stats();
```

### 5.2 Update User Followers Count
```sql
-- Function to update follower count
CREATE OR REPLACE FUNCTION update_user_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trigger_update_followers_count
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW
EXECUTE FUNCTION update_user_followers_count();
```

### 5.3 Update Timestamps
```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. Migration Notes

### Key Differences from Current Structure:

1. **User Management:** Current app has no real user system. Supabase provides authentication out of the box.

2. **Price Storage:** 
   - Current: Price as string (e.g., "$24.99") 
   - Proposed: Price as DECIMAL, with `is_free` boolean flag

3. **Categories:** 
   - Current: String-based category field
   - Proposed: Proper relational structure with `categories` table

4. **Creator/Author:**
   - Current: Author as string name
   - Proposed: `creator_id` foreign key to `users` table

5. **Product Stats:**
   - Current: Direct fields on items (views, likes, downloads)
   - Proposed: Separate `product_interactions` table for tracking, with aggregated counts on products table

6. **Cart:**
   - Current: Simple array of items
   - Proposed: Proper `carts` and `cart_items` tables with user relationship

7. **Badges:**
   - Current: Simple string field
   - Proposed: CHECK constraint to enforce valid badge values

### Migration Strategy:

1. **Phase 1:** Set up Supabase project and create tables
2. **Phase 2:** Migrate category data to `categories` table
3. **Phase 3:** Create user accounts for creators/authors
4. **Phase 4:** Migrate product data to `products` table
5. **Phase 5:** Implement authentication and user management
6. **Phase 6:** Implement cart functionality
7. **Phase 7:** Add interaction tracking (views, likes, downloads)
8. **Phase 8:** Implement orders and checkout

---

## 7. Additional Considerations

### Storage:
- Consider using Supabase Storage for product images
- Store images with paths like: `products/{product_id}/{filename}`

### Search:
- Consider using PostgreSQL full-text search or Supabase Vector for product search
- Add search indexes on product titles and descriptions

### Performance:
- Consider materialized views for trending/popular products
- Use database functions for aggregations
- Implement caching strategy for frequently accessed data

### Security:
- All tables have RLS (Row Level Security) enabled
- Policies ensure users can only access their own data
- Public data (products, categories) is readable by all

---

## Summary

The current application uses **programmatically generated mock data** with no database backend. This schema proposal provides a comprehensive, normalized database structure suitable for Supabase that:

- Maintains all current functionality
- Adds proper relationships and constraints
- Includes user management and authentication
- Supports e-commerce features (cart, orders)
- Tracks user interactions
- Enables scalability and performance optimization
