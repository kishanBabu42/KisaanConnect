package com.kisaanconnect.data.repository

import com.kisaanconnect.data.models.*
import com.kisaanconnect.data.network.ApiClient
import com.kisaanconnect.utils.Resource
import com.kisaanconnect.utils.safeApiCall
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class ProductRepository {
    private val api = ApiClient.service

    suspend fun getProducts(
        page: Int = 1, limit: Int = 20,
        category: String? = null, search: String? = null,
        sort: String? = null, minPrice: Double? = null, maxPrice: Double? = null
    ): Resource<ProductsResponse> = safeApiCall {
        api.getProducts(page, limit, category, search, sort, minPrice, maxPrice)
    }

    suspend fun getProductById(id: Int): Resource<Product> =
        safeApiCall { api.getProductById(id) }

    suspend fun getProductsByFarmer(farmerId: Int): Resource<ProductsResponse> =
        safeApiCall { api.getProductsByFarmer(farmerId) }

    suspend fun createProduct(
        name: String, description: String, price: Double, marketPrice: Double,
        quantity: Double, category: String, location: String, freshness: String,
        imageFile: File? = null
    ): Resource<Product> = safeApiCall {
        val namePart = name.toRequestBody("text/plain".toMediaTypeOrNull())
        val descPart = description.toRequestBody("text/plain".toMediaTypeOrNull())
        val pricePart = price.toString().toRequestBody("text/plain".toMediaTypeOrNull())
        val mktPricePart = marketPrice.toString().toRequestBody("text/plain".toMediaTypeOrNull())
        val qtyPart = quantity.toString().toRequestBody("text/plain".toMediaTypeOrNull())
        val catPart = category.toRequestBody("text/plain".toMediaTypeOrNull())
        val locPart = location.toRequestBody("text/plain".toMediaTypeOrNull())
        val freshPart = freshness.toRequestBody("text/plain".toMediaTypeOrNull())
        val imagePart = imageFile?.let {
            val reqFile = it.asRequestBody("image/*".toMediaTypeOrNull())
            MultipartBody.Part.createFormData("image", it.name, reqFile)
        }
        api.createProduct(namePart, descPart, pricePart, mktPricePart, qtyPart, catPart, locPart, freshPart, imagePart)
    }

    suspend fun updateProduct(
        id: Int, name: String, description: String, price: Double, marketPrice: Double,
        quantity: Double, category: String, location: String, freshness: String,
        imageFile: File? = null
    ): Resource<Product> = safeApiCall {
        val namePart = name.toRequestBody("text/plain".toMediaTypeOrNull())
        val descPart = description.toRequestBody("text/plain".toMediaTypeOrNull())
        val pricePart = price.toString().toRequestBody("text/plain".toMediaTypeOrNull())
        val mktPricePart = marketPrice.toString().toRequestBody("text/plain".toMediaTypeOrNull())
        val qtyPart = quantity.toString().toRequestBody("text/plain".toMediaTypeOrNull())
        val catPart = category.toRequestBody("text/plain".toMediaTypeOrNull())
        val locPart = location.toRequestBody("text/plain".toMediaTypeOrNull())
        val freshPart = freshness.toRequestBody("text/plain".toMediaTypeOrNull())
        val imagePart = imageFile?.let {
            val reqFile = it.asRequestBody("image/*".toMediaTypeOrNull())
            MultipartBody.Part.createFormData("image", it.name, reqFile)
        }
        api.updateProduct(id, namePart, descPart, pricePart, mktPricePart, qtyPart, catPart, locPart, freshPart, imagePart)
    }

    suspend fun deleteProduct(id: Int): Resource<GenericResponse> =
        safeApiCall { api.deleteProduct(id) }

    suspend fun placeBid(request: BidRequest): Resource<Bid> =
        safeApiCall { api.placeBid(request) }

    suspend fun getBids(userId: Int): Resource<List<Bid>> =
        safeApiCall { api.getBids(userId) }

    suspend fun getFarmerBids(farmerId: Int): Resource<List<Bid>> =
        safeApiCall { api.getFarmerBids(farmerId) }

    suspend fun acceptBid(id: Int): Resource<GenericResponse> =
        safeApiCall { api.acceptBid(id) }

    suspend fun rejectBid(id: Int): Resource<GenericResponse> =
        safeApiCall { api.rejectBid(id) }
}
