package com.kisaanconnect.utils

sealed class Resource<out T> {
    data class Success<T>(val data: T) : Resource<T>()
    data class Error(val message: String, val code: Int = -1) : Resource<Nothing>()
    object Loading : Resource<Nothing>()
    object Idle : Resource<Nothing>()
}

fun <T> Resource<T>.onSuccess(block: (T) -> Unit): Resource<T> {
    if (this is Resource.Success) block(data)
    return this
}

fun <T> Resource<T>.onError(block: (String) -> Unit): Resource<T> {
    if (this is Resource.Error) block(message)
    return this
}

fun <T> Resource<T>.onLoading(block: () -> Unit): Resource<T> {
    if (this is Resource.Loading) block()
    return this
}
