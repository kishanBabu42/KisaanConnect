package com.kisaanconnect.ui.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kisaanconnect.data.models.*
import com.kisaanconnect.data.repository.*
import com.kisaanconnect.utils.Resource
import kotlinx.coroutines.launch

class OrderViewModel : ViewModel() {
    private val repo = OrderRepository()

    private val _orders = MutableLiveData<Resource<List<Order>>>()
    val orders: LiveData<Resource<List<Order>>> = _orders

    private val _orderDetail = MutableLiveData<Resource<Order>>()
    val orderDetail: LiveData<Resource<Order>> = _orderDetail

    private val _statusUpdate = MutableLiveData<Resource<GenericResponse>>()
    val statusUpdate: LiveData<Resource<GenericResponse>> = _statusUpdate

    fun loadOrders(userId: Int) {
        _orders.value = Resource.Loading
        viewModelScope.launch { _orders.value = repo.getOrders(userId) }
    }

    fun loadOrder(id: Int) {
        _orderDetail.value = Resource.Loading
        viewModelScope.launch { _orderDetail.value = repo.getOrderById(id) }
    }

    fun updateStatus(id: Int, status: String) {
        _statusUpdate.value = Resource.Loading
        viewModelScope.launch { _statusUpdate.value = repo.updateOrderStatus(id, status) }
    }
}

class HomeViewModel : ViewModel() {
    private val productRepo = ProductRepository()
    private val userRepo = UserRepository()

    private val _featuredProducts = MutableLiveData<Resource<ProductsResponse>>()
    val featuredProducts: LiveData<Resource<ProductsResponse>> = _featuredProducts

    private val _walletBalance = MutableLiveData<Double>(0.0)
    val walletBalance: LiveData<Double> = _walletBalance

    fun loadFeatured() {
        _featuredProducts.value = Resource.Loading
        viewModelScope.launch {
            _featuredProducts.value = productRepo.getProducts(limit = 10, sort = "newest")
        }
    }

    fun loadWallet(userId: Int) {
        viewModelScope.launch {
            val result = userRepo.getWalletBalance(userId)
            if (result is Resource.Success) {
                val balance = (result.data["balance"] as? Double) ?: 0.0
                _walletBalance.value = balance
            }
        }
    }
}

class NotificationViewModel : ViewModel() {
    private val repo = NotificationRepository()

    private val _notifications = MutableLiveData<Resource<List<AppNotification>>>()
    val notifications: LiveData<Resource<List<AppNotification>>> = _notifications

    private val _action = MutableLiveData<Resource<GenericResponse>>()
    val action: LiveData<Resource<GenericResponse>> = _action

    fun load(userId: Int) {
        _notifications.value = Resource.Loading
        viewModelScope.launch { _notifications.value = repo.getNotifications(userId) }
    }

    fun markRead(id: Int) = viewModelScope.launch { repo.markRead(id) }

    fun markAllRead(userId: Int) {
        viewModelScope.launch {
            _action.value = repo.markAllRead(userId)
            load(userId)
        }
    }
}

class AiViewModel : ViewModel() {
    private val repo = AiRepository()

    private val _messages = MutableLiveData<MutableList<ChatMessage>>(mutableListOf())
    val messages: LiveData<MutableList<ChatMessage>> = _messages

    private val _sending = MutableLiveData(false)
    val sending: LiveData<Boolean> = _sending

    fun send(message: String, role: String) {
        val current = _messages.value ?: mutableListOf()
        current.add(ChatMessage(content = message, isFromUser = true))
        _messages.value = current
        _sending.value = true

        viewModelScope.launch {
            val result = repo.sendMessage(message, role)
            val reply = when (result) {
                is Resource.Success -> result.data.reply ?: "I'm here to help! 🌱"
                is Resource.Error -> "Sorry, I couldn't connect. Please try again."
                else -> "..."
            }
            val updated = _messages.value ?: mutableListOf()
            updated.add(ChatMessage(content = reply, isFromUser = false))
            _messages.value = updated
            _sending.value = false
        }
    }

    fun clearChat() { _messages.value = mutableListOf() }
}

class ProfileViewModel : ViewModel() {
    private val repo = UserRepository()

    private val _profile = MutableLiveData<Resource<AuthResponse>>()
    val profile: LiveData<Resource<AuthResponse>> = _profile

    private val _transactions = MutableLiveData<Resource<List<WalletTransaction>>>()
    val transactions: LiveData<Resource<List<WalletTransaction>>> = _transactions

    private val _topUpState = MutableLiveData<Resource<GenericResponse>>()
    val topUpState: LiveData<Resource<GenericResponse>> = _topUpState

    fun loadProfile(id: Int) {
        _profile.value = Resource.Loading
        viewModelScope.launch { _profile.value = repo.getUserById(id) }
    }

    fun loadTransactions(id: Int) {
        viewModelScope.launch { _transactions.value = repo.getTransactions(id) }
    }

    fun topUp(id: Int, amount: Double) {
        _topUpState.value = Resource.Loading
        viewModelScope.launch { _topUpState.value = repo.topUpWallet(id, amount) }
    }
}

class FarmerDashboardViewModel : ViewModel() {
    private val productRepo = ProductRepository()
    private val orderRepo = OrderRepository()
    private val userRepo = UserRepository()

    private val _products = MutableLiveData<Resource<ProductsResponse>>()
    val products: LiveData<Resource<ProductsResponse>> = _products

    private val _bids = MutableLiveData<Resource<List<Bid>>>()
    val bids: LiveData<Resource<List<Bid>>> = _bids

    private val _orders = MutableLiveData<Resource<List<Order>>>()
    val orders: LiveData<Resource<List<Order>>> = _orders

    private val _walletBalance = MutableLiveData<Double>(0.0)
    val walletBalance: LiveData<Double> = _walletBalance

    private val _totalEarnings = MutableLiveData<Double>(0.0)
    val totalEarnings: LiveData<Double> = _totalEarnings

    fun loadAll(farmerId: Int) {
        loadProducts(farmerId)
        loadBids(farmerId)
        loadOrders(farmerId)
        loadWallet(farmerId)
    }

    fun loadProducts(farmerId: Int) {
        _products.value = Resource.Loading
        viewModelScope.launch { _products.value = productRepo.getProductsByFarmer(farmerId) }
    }

    fun loadBids(farmerId: Int) {
        _bids.value = Resource.Loading
        viewModelScope.launch { _bids.value = productRepo.getFarmerBids(farmerId) }
    }

    fun loadOrders(farmerId: Int) {
        _orders.value = Resource.Loading
        viewModelScope.launch { _orders.value = orderRepo.getOrders(farmerId) }
    }

    fun loadWallet(userId: Int) {
        viewModelScope.launch {
            val result = userRepo.getWalletBalance(userId)
            if (result is Resource.Success) {
                _walletBalance.value = (result.data["balance"] as? Double) ?: 0.0
                _totalEarnings.value = (result.data["totalEarnings"] as? Double) ?: 0.0
            }
        }
    }

    fun acceptBid(id: Int) {
        viewModelScope.launch { productRepo.acceptBid(id) }
    }

    fun rejectBid(id: Int) {
        viewModelScope.launch { productRepo.rejectBid(id) }
    }
}
