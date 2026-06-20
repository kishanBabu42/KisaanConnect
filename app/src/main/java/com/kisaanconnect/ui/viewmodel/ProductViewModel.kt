package com.kisaanconnect.ui.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kisaanconnect.data.models.*
import com.kisaanconnect.data.repository.ProductRepository
import com.kisaanconnect.utils.Resource
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

class ProductViewModel : ViewModel() {

    private val repository = ProductRepository()

    // ── Product List ──────────────────────────────────────────────────────────
    private val _products = MutableLiveData<Resource<ProductsResponse>>()
    val products: LiveData<Resource<ProductsResponse>> = _products

    private val _farmerProducts = MutableLiveData<Resource<ProductsResponse>>()
    val farmerProducts: LiveData<Resource<ProductsResponse>> = _farmerProducts

    private val _selectedProduct = MutableLiveData<Resource<Product>>()
    val selectedProduct: LiveData<Resource<Product>> = _selectedProduct

    // ── Bids ──────────────────────────────────────────────────────────────────
    private val _bids = MutableLiveData<Resource<List<Bid>>>()
    val bids: LiveData<Resource<List<Bid>>> = _bids

    private val _farmerBids = MutableLiveData<Resource<List<Bid>>>()
    val farmerBids: LiveData<Resource<List<Bid>>> = _farmerBids

    private val _bidAction = MutableLiveData<Resource<GenericResponse>>()
    val bidAction: LiveData<Resource<GenericResponse>> = _bidAction

    private val _createProductState = MutableLiveData<Resource<Product>>()
    val createProductState: LiveData<Resource<Product>> = _createProductState

    private val _deleteState = MutableLiveData<Resource<GenericResponse>>()
    val deleteState: LiveData<Resource<GenericResponse>> = _deleteState

    // ── Wishlist (local) ───────────────────────────────────────────────────────
    private val _wishlist = MutableLiveData<MutableSet<Int>>(mutableSetOf())
    val wishlist: LiveData<MutableSet<Int>> = _wishlist

    // ── Cart (local) ──────────────────────────────────────────────────────────
    private val _cart = MutableLiveData<MutableList<CartItem>>(mutableListOf())
    val cart: LiveData<MutableList<CartItem>> = _cart

    // ── Search debounce ───────────────────────────────────────────────────────
    private var searchJob: Job? = null
    var currentCategory: String? = null
    var currentSearch: String? = null
    var currentSort: String? = null

    // ── Product Fetching ──────────────────────────────────────────────────────
    fun loadProducts(
        page: Int = 1, limit: Int = 20,
        category: String? = currentCategory,
        search: String? = currentSearch,
        sort: String? = currentSort
    ) {
        _products.value = Resource.Loading
        viewModelScope.launch {
            _products.value = repository.getProducts(page, limit, category, search, sort)
        }
    }

    fun searchProducts(query: String) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(400) // debounce
            currentSearch = query.ifBlank { null }
            loadProducts()
        }
    }

    fun filterByCategory(category: String?) {
        currentCategory = category
        loadProducts()
    }

    fun loadProductById(id: Int) {
        _selectedProduct.value = Resource.Loading
        viewModelScope.launch {
            _selectedProduct.value = repository.getProductById(id)
        }
    }

    fun loadFarmerProducts(farmerId: Int) {
        _farmerProducts.value = Resource.Loading
        viewModelScope.launch {
            _farmerProducts.value = repository.getProductsByFarmer(farmerId)
        }
    }

    // ── Product CRUD ──────────────────────────────────────────────────────────
    fun createProduct(
        name: String, description: String, price: Double, marketPrice: Double,
        quantity: Double, category: String, location: String, freshness: String,
        imageFile: File? = null
    ) {
        _createProductState.value = Resource.Loading
        viewModelScope.launch {
            _createProductState.value = repository.createProduct(
                name, description, price, marketPrice, quantity, category, location, freshness, imageFile
            )
        }
    }

    fun updateProduct(
        id: Int, name: String, description: String, price: Double, marketPrice: Double,
        quantity: Double, category: String, location: String, freshness: String,
        imageFile: File? = null
    ) {
        _createProductState.value = Resource.Loading
        viewModelScope.launch {
            _createProductState.value = repository.updateProduct(
                id, name, description, price, marketPrice, quantity, category, location, freshness, imageFile
            )
        }
    }

    fun deleteProduct(id: Int) {
        _deleteState.value = Resource.Loading
        viewModelScope.launch {
            _deleteState.value = repository.deleteProduct(id)
        }
    }

    // ── Bids ──────────────────────────────────────────────────────────────────
    fun loadBids(userId: Int) {
        _bids.value = Resource.Loading
        viewModelScope.launch { _bids.value = repository.getBids(userId) }
    }

    fun loadFarmerBids(farmerId: Int) {
        _farmerBids.value = Resource.Loading
        viewModelScope.launch { _farmerBids.value = repository.getFarmerBids(farmerId) }
    }

    fun placeBid(request: BidRequest) {
        _bidAction.value = Resource.Loading
        viewModelScope.launch {
            val result = repository.placeBid(request)
            _bidAction.value = when (result) {
                is Resource.Success -> Resource.Success(GenericResponse(true, "Bid placed successfully"))
                is Resource.Error -> Resource.Error(result.message)
                else -> Resource.Error("Unknown error")
            }
        }
    }

    fun acceptBid(id: Int) {
        _bidAction.value = Resource.Loading
        viewModelScope.launch { _bidAction.value = repository.acceptBid(id) }
    }

    fun rejectBid(id: Int) {
        _bidAction.value = Resource.Loading
        viewModelScope.launch { _bidAction.value = repository.rejectBid(id) }
    }

    // ── Wishlist ──────────────────────────────────────────────────────────────
    fun toggleWishlist(productId: Int): Boolean {
        val current = _wishlist.value ?: mutableSetOf()
        return if (current.contains(productId)) {
            current.remove(productId)
            _wishlist.value = current
            false
        } else {
            current.add(productId)
            _wishlist.value = current
            true
        }
    }

    fun isWishlisted(productId: Int) = _wishlist.value?.contains(productId) == true

    // ── Cart ──────────────────────────────────────────────────────────────────
    fun addToCart(product: Product, quantity: Double = 1.0) {
        val current = _cart.value ?: mutableListOf()
        val existing = current.find { it.product.id == product.id }
        if (existing != null) {
            existing.quantity += quantity
        } else {
            current.add(CartItem(product = product, quantity = quantity))
        }
        _cart.value = current
    }

    fun removeFromCart(productId: Int) {
        val current = _cart.value ?: mutableListOf()
        current.removeAll { it.product.id == productId }
        _cart.value = current
    }

    fun updateCartQuantity(productId: Int, quantity: Double) {
        val current = _cart.value ?: mutableListOf()
        current.find { it.product.id == productId }?.quantity = quantity
        _cart.value = current
    }

    fun clearCart() { _cart.value = mutableListOf() }

    fun getCartSummary(): CartSummary {
        val items = _cart.value ?: emptyList()
        val subtotal = items.sumOf { it.subtotal() }
        val deliveryFee = if (subtotal > 500) 0.0 else 40.0
        val platformFee = subtotal * 0.02
        return CartSummary(items, subtotal, deliveryFee, platformFee, subtotal + deliveryFee + platformFee)
    }

    fun cartItemCount() = _cart.value?.sumOf { it.quantity.toInt() } ?: 0
}
