package com.kisaanconnect.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.kisaanconnect.data.models.*
import com.kisaanconnect.databinding.*
import com.kisaanconnect.utils.*

// ── Product Card Adapter (horizontal / grid) ──────────────────────────────────
class ProductCardAdapter(
    private val onProductClick: (Product) -> Unit,
    private val onWishlistClick: ((Product) -> Unit)? = null,
    private val onAddToCartClick: ((Product) -> Unit)? = null
) : ListAdapter<Product, ProductCardAdapter.ViewHolder>(ProductDiffCallback()) {

    inner class ViewHolder(val binding: ItemProductCardBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(product: Product) {
            binding.apply {
                tvProductName.text = product.name
                tvPrice.text = product.formattedPrice()
                tvLocation.text = product.location
                tvFreshness.text = product.freshness
                tvFarmerName.text = product.farmerName
                ivProduct.loadRounded(product.imageUrl, radius = 16f)

                val savings = product.savingsPercent()
                tvDiscount.showIf(savings > 0)
                tvDiscount.text = "-${savings}%"

                root.setOnClickListener { onProductClick(product) }
                btnWishlist.setOnClickListener { onWishlistClick?.invoke(product) }
                btnAddCart.setOnClickListener { onAddToCartClick?.invoke(product) }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemProductCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(holder: ViewHolder, position: Int) =
        holder.bind(getItem(position))
}

// ── Product List Adapter (full-width rows) ────────────────────────────────────
class ProductListAdapter(
    private val onProductClick: (Product) -> Unit,
    private val onCartClick: (Product) -> Unit
) : ListAdapter<Product, ProductListAdapter.ViewHolder>(ProductDiffCallback()) {

    inner class ViewHolder(val binding: ItemProductListBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(product: Product) {
            binding.apply {
                tvName.text = product.name
                tvPrice.text = product.formattedPrice()
                tvQty.text = "${product.quantity.toInt()} kg available"
                tvFarmer.text = product.farmerName
                tvLocation.text = product.location
                ivProduct.loadRounded(product.imageUrl, radius = 12f)
                root.setOnClickListener { onProductClick(product) }
                btnCart.setOnClickListener { onCartClick(product) }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemProductListBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── Category Adapter ──────────────────────────────────────────────────────────
class CategoryAdapter(
    private val onCategoryClick: (com.kisaanconnect.data.models.Category) -> Unit
) : ListAdapter<com.kisaanconnect.data.models.Category, CategoryAdapter.ViewHolder>(CategoryDiffCallback()) {

    companion object {
        fun getDefaultCategories() = listOf(
            com.kisaanconnect.data.models.Category("all", "All", com.kisaanconnect.R.drawable.logo, "#059669"),
            com.kisaanconnect.data.models.Category("vegetables", "Vegetables", com.kisaanconnect.R.drawable.logo, "#10B981"),
            com.kisaanconnect.data.models.Category("fruits", "Fruits", com.kisaanconnect.R.drawable.logo, "#F59E0B"),
            com.kisaanconnect.data.models.Category("grains", "Grains", com.kisaanconnect.R.drawable.logo, "#8B5CF6"),
            com.kisaanconnect.data.models.Category("dairy", "Dairy", com.kisaanconnect.R.drawable.logo, "#3B82F6"),
            com.kisaanconnect.data.models.Category("spices", "Spices", com.kisaanconnect.R.drawable.logo, "#EF4444"),
            com.kisaanconnect.data.models.Category("herbs", "Herbs", com.kisaanconnect.R.drawable.logo, "#059669")
        )
    }

    inner class ViewHolder(val binding: ItemCategoryBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(category: com.kisaanconnect.data.models.Category) {
            binding.tvName.text = category.name
            binding.ivIcon.setImageResource(category.iconRes)
            binding.root.setOnClickListener { onCategoryClick(category) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemCategoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── Cart Item Adapter ─────────────────────────────────────────────────────────
class CartAdapter(
    private val onRemove: (CartItem) -> Unit,
    private val onQuantityChange: (CartItem, Double) -> Unit
) : ListAdapter<CartItem, CartAdapter.ViewHolder>(CartDiffCallback()) {

    inner class ViewHolder(val binding: ItemCartBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: CartItem) {
            binding.apply {
                tvName.text = item.product.name
                tvPrice.text = item.product.formattedPrice()
                tvSubtotal.text = item.formattedSubtotal()
                tvQty.text = item.quantity.toInt().toString()
                ivProduct.loadRounded(item.product.imageUrl, radius = 10f)
                btnRemove.setOnClickListener { onRemove(item) }
                btnIncrease.setOnClickListener {
                    onQuantityChange(item, item.quantity + 1)
                }
                btnDecrease.setOnClickListener {
                    if (item.quantity > 1) onQuantityChange(item, item.quantity - 1)
                    else onRemove(item)
                }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemCartBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── Order Adapter ─────────────────────────────────────────────────────────────
class OrderAdapter(
    private val onClick: (Order) -> Unit
) : ListAdapter<Order, OrderAdapter.ViewHolder>(OrderDiffCallback()) {

    inner class ViewHolder(val binding: ItemOrderBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(order: Order) {
            binding.apply {
                tvOrderId.text = "#${order.orderId}"
                tvProductName.text = order.productName
                tvTotal.text = order.formattedTotal()
                tvDate.text = order.createdAt.toDisplayDate()
                tvStatus.text = order.statusLabel()
                tvStatus.setTextColor(android.graphics.Color.parseColor(order.statusColor()))
                ivProduct.loadRounded(order.productImage, radius = 10f)
                root.setOnClickListener { onClick(order) }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemOrderBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── Bid Adapter ───────────────────────────────────────────────────────────────
class BidAdapter(
    private val onAccept: (Bid) -> Unit,
    private val onReject: (Bid) -> Unit
) : ListAdapter<Bid, BidAdapter.ViewHolder>(BidDiffCallback()) {

    inner class ViewHolder(val binding: ItemBidBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(bid: Bid) {
            binding.apply {
                tvProductName.text = bid.productName
                tvCustomerName.text = bid.customerName
                tvQty.text = "${bid.quantity.toInt()} kg"
                tvBidPrice.text = "₹${String.format("%.0f", bid.bidPrice)}/kg"
                tvTotal.text = "₹${String.format("%.0f", bid.totalAmount)}"
                tvStatus.text = bid.status.replaceFirstChar { it.uppercase() }
                tvDate.text = bid.createdAt.toRelativeTime()
                btnAccept.setOnClickListener { onAccept(bid) }
                btnReject.setOnClickListener { onReject(bid) }
                val isPending = bid.status == "pending"
                btnAccept.showIf(isPending)
                btnReject.showIf(isPending)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemBidBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── Chat Message Adapter ──────────────────────────────────────────────────────
class ChatAdapter : ListAdapter<ChatMessage, ChatAdapter.ViewHolder>(ChatDiffCallback()) {

    companion object {
        private const val TYPE_USER = 0
        private const val TYPE_AI = 1
    }

    inner class ViewHolder(val binding: ItemChatMessageBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(msg: ChatMessage) {
            if (msg.isFromUser) {
                binding.tvMessageUser.show()
                binding.tvMessageAi.hide()
                binding.tvUserText.text = msg.content
            } else {
                binding.tvMessageUser.hide()
                binding.tvMessageAi.show()
                binding.tvAiText.text = msg.content
            }
        }
    }

    override fun getItemViewType(position: Int) =
        if (getItem(position).isFromUser) TYPE_USER else TYPE_AI

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemChatMessageBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── Notification Adapter ──────────────────────────────────────────────────────
class NotificationAdapter(
    private val onClick: (AppNotification) -> Unit
) : ListAdapter<AppNotification, NotificationAdapter.ViewHolder>(NotifDiffCallback()) {

    inner class ViewHolder(val binding: ItemNotificationBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(notif: AppNotification) {
            binding.tvTitle.text = notif.title
            binding.tvBody.text = notif.body
            binding.tvTime.text = notif.createdAt.toRelativeTime()
            binding.root.alpha = if (notif.isRead) 0.6f else 1f
            binding.root.setOnClickListener { onClick(notif) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemNotificationBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── Farmer Product Adapter ────────────────────────────────────────────────────
class FarmerProductAdapter(
    private val onEdit: (Product) -> Unit,
    private val onDelete: (Product) -> Unit
) : ListAdapter<Product, FarmerProductAdapter.ViewHolder>(ProductDiffCallback()) {

    inner class ViewHolder(val binding: ItemFarmerProductBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(product: Product) {
            binding.apply {
                tvName.text = product.name
                tvPrice.text = product.formattedPrice()
                tvQty.text = "${product.quantity.toInt()} kg"
                tvStatus.text = product.status.replaceFirstChar { it.uppercase() }
                ivProduct.loadRounded(product.imageUrl, radius = 10f)
                btnEdit.setOnClickListener { onEdit(product) }
                btnDelete.setOnClickListener { onDelete(product) }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ViewHolder(
        ItemFarmerProductBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(h: ViewHolder, pos: Int) = h.bind(getItem(pos))
}

// ── DiffUtil Callbacks ────────────────────────────────────────────────────────
class ProductDiffCallback : DiffUtil.ItemCallback<Product>() {
    override fun areItemsTheSame(old: Product, new: Product) = old.id == new.id
    override fun areContentsTheSame(old: Product, new: Product) = old == new
}
class CategoryDiffCallback : DiffUtil.ItemCallback<com.kisaanconnect.data.models.Category>() {
    override fun areItemsTheSame(o: com.kisaanconnect.data.models.Category, n: com.kisaanconnect.data.models.Category) = o.id == n.id
    override fun areContentsTheSame(o: com.kisaanconnect.data.models.Category, n: com.kisaanconnect.data.models.Category) = o == n
}
class CartDiffCallback : DiffUtil.ItemCallback<CartItem>() {
    override fun areItemsTheSame(o: CartItem, n: CartItem) = o.product.id == n.product.id
    override fun areContentsTheSame(o: CartItem, n: CartItem) = o == n
}
class OrderDiffCallback : DiffUtil.ItemCallback<Order>() {
    override fun areItemsTheSame(o: Order, n: Order) = o.id == n.id
    override fun areContentsTheSame(o: Order, n: Order) = o == n
}
class BidDiffCallback : DiffUtil.ItemCallback<Bid>() {
    override fun areItemsTheSame(o: Bid, n: Bid) = o.id == n.id
    override fun areContentsTheSame(o: Bid, n: Bid) = o == n
}
class ChatDiffCallback : DiffUtil.ItemCallback<ChatMessage>() {
    override fun areItemsTheSame(o: ChatMessage, n: ChatMessage) = o.id == n.id
    override fun areContentsTheSame(o: ChatMessage, n: ChatMessage) = o == n
}
class NotifDiffCallback : DiffUtil.ItemCallback<AppNotification>() {
    override fun areItemsTheSame(o: AppNotification, n: AppNotification) = o.id == n.id
    override fun areContentsTheSame(o: AppNotification, n: AppNotification) = o == n
}
