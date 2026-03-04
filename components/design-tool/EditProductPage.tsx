'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PreviewWorkspace from './PreviewWorkspace'
import { useAuth } from '@/components/AuthProvider'
import {
  getProductById,
  getCategories,
  updateProduct,
  setProductCategories,
} from '@/lib/supabaseClient'
import type { CategoryRow } from '@/lib/supabaseClient'
import type { ProductDetailRow } from '@/lib/supabaseClient'
import '../../styles/DesignTool.css'

interface EditProductPageProps {
  productId: string
}

export default function EditProductPage({ productId }: EditProductPageProps) {
  const router = useRouter()
  const { userAccount } = useAuth()
  const [product, setProduct] = useState<ProductDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState<string>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [designData, setDesignData] = useState<Record<string, unknown>>({})
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)

  const id = parseInt(productId, 10)

  useEffect(() => {
    if (Number.isNaN(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    if (!userAccount) {
      setLoading(false)
      return
    }
    let cancelled = false
    Promise.all([getProductById(id), getCategories()]).then(([prod, cats]) => {
      if (cancelled) return
      setCategories(cats ?? [])
      if (!prod) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const ownerId = (prod as { user_account_id?: number }).user_account_id
      if (ownerId !== userAccount.id) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setProduct(prod)
      const row = prod as { name?: string; price?: number; design_data?: Record<string, unknown>; product_category?: Array<{ category_id: number }> }
      setName(row.name ?? '')
      setPrice(row.price != null ? String(row.price) : '')
      const firstCat = row.product_category?.[0]?.category_id
      setCategoryId(firstCat != null ? firstCat : '')
      setDesignData(row.design_data && typeof row.design_data === 'object' ? { ...row.design_data } : {})
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id, userAccount?.id])

  useEffect(() => {
    if (!userAccount && !loading) {
      setForbidden(true)
    }
  }, [userAccount, loading])

  const handleSave = useCallback(async () => {
    if (!userAccount || !product) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setSaveError('Please enter a product name.')
      return
    }
    const priceNum = parseFloat(price)
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setSaveError('Please enter a valid price (0 or greater).')
      return
    }
    setSaveError(null)
    setSaveLoading(true)
    try {
      const ok = await updateProduct(id, {
        name: trimmedName,
        price: priceNum,
        design_data: Object.keys(designData).length ? designData : undefined,
      })
      if (!ok) {
        setSaveError('Failed to update product.')
        setSaveLoading(false)
        return
      }
      const catOk = await setProductCategories(id, categoryId !== '' ? [categoryId as number] : [])
      if (!catOk) {
        setSaveError('Product updated but categories could not be saved.')
      }
      router.push('/profile')
    } catch {
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaveLoading(false)
    }
  }, [userAccount, product, id, name, price, categoryId, designData, router])

  if (loading) {
    return (
      <div className="design-tool-page">
        <p className="design-tool-loading" aria-live="polite">Loading product…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="design-tool-page">
        <p className="design-tool-form-error">Product not found.</p>
        <button type="button" className="design-tool-btn design-tool-btn-publish" onClick={() => router.push('/profile')}>
          Back to My Products
        </button>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="design-tool-page">
        <p className="design-tool-form-error">You don’t have permission to edit this product.</p>
        <button type="button" className="design-tool-btn design-tool-btn-publish" onClick={() => router.push('/profile')}>
          Back to My Products
        </button>
      </div>
    )
  }

  return (
    <div className="design-tool-page">
      <div className="design-tool-layout">
        <section
          className="design-tool-left design-tool-left--manual"
          id="design-tool-edit-panel"
          role="region"
          aria-labelledby="design-tool-edit-title"
        >
          <h2 id="design-tool-edit-title" className="design-tool-edit-heading">Edit product</h2>
          <div className="design-tool-product-form">
            <label htmlFor="design-tool-edit-name" className="design-tool-label">
              Name
            </label>
            <input
              id="design-tool-edit-name"
              type="text"
              className="design-tool-input"
              placeholder="Product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-required
            />
            <label htmlFor="design-tool-edit-price" className="design-tool-label">
              Price ($)
            </label>
            <input
              id="design-tool-edit-price"
              type="number"
              min={0}
              step={0.01}
              className="design-tool-input"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-required
            />
            <label htmlFor="design-tool-edit-category" className="design-tool-label">
              Category
            </label>
            <select
              id="design-tool-edit-category"
              className="design-tool-select"
              value={categoryId === '' ? '' : String(categoryId)}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {saveError && (
              <p className="design-tool-form-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="design-tool-form-actions">
              <button
                type="button"
                className="design-tool-btn design-tool-btn-publish"
                disabled={saveLoading}
                onClick={handleSave}
              >
                {saveLoading ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="design-tool-btn design-tool-btn-draft"
                disabled={saveLoading}
                onClick={() => router.push('/profile')}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
        <section
          className="design-tool-right"
          aria-label="Design preview"
          role="region"
        >
          <PreviewWorkspace
            mode="manual"
            onImageSelect={(url) => setDesignData((prev) => ({ ...prev, imageUrl: url }))}
            imageUrl={typeof designData.imageUrl === 'string' ? designData.imageUrl : null}
            onImageClear={() => setDesignData((prev) => {
              const next = { ...prev }
              delete next.imageUrl
              return next
            })}
          />
        </section>
      </div>
    </div>
  )
}
