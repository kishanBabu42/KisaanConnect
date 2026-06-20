package com.kisaanconnect.ui.farmer

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentAddProductBinding
import com.kisaanconnect.ui.viewmodel.ProductViewModel
import com.kisaanconnect.utils.*
import java.io.File

class AddProductFragment : Fragment() {

    private var _binding: FragmentAddProductBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ProductViewModel by activityViewModels()
    private var selectedImageUri: Uri? = null
    private var selectedImageFile: File? = null

    private val imagePicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            selectedImageUri = it
            binding.ivProductImage.setImageURI(it)
            binding.tvAddPhoto.hide()
            selectedImageFile = uriToFile(it)
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAddProductBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupCategoryDropdown()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupCategoryDropdown() {
        val categories = listOf("Vegetables", "Fruits", "Grains", "Dairy", "Spices", "Herbs", "Other")
        val adapter = android.widget.ArrayAdapter(
            requireContext(), android.R.layout.simple_dropdown_item_1line, categories
        )
        binding.autoCompleteCategory.setAdapter(adapter)
    }

    private fun setupClickListeners() {
        binding.toolbar.setNavigationOnClickListener { findNavController().navigateUp() }
        binding.cardImagePicker.setOnClickListener { imagePicker.launch("image/*") }
        binding.btnSave.setOnClickListener { attemptSave() }
    }

    private fun attemptSave() {
        val name = binding.etName.text.toString().trim()
        val description = binding.etDescription.text.toString().trim()
        val price = binding.etPrice.text.toString().toDoubleOrNull()
        val marketPrice = binding.etMarketPrice.text.toString().toDoubleOrNull()
        val quantity = binding.etQuantity.text.toString().toDoubleOrNull()
        val category = binding.autoCompleteCategory.text.toString().trim()
        val location = binding.etLocation.text.toString().trim()
        val freshness = binding.etFreshness.text.toString().trim()
        var valid = true

        if (name.isBlank()) { binding.tilName.error = "Enter crop name"; valid = false }
        if (price == null || price <= 0) { binding.tilPrice.error = "Enter valid price"; valid = false }
        if (marketPrice == null || marketPrice <= 0) { binding.tilMarketPrice.error = "Enter valid market price"; valid = false }
        if (quantity == null || quantity <= 0) { binding.tilQuantity.error = "Enter valid quantity"; valid = false }
        if (category.isBlank()) { binding.tilCategory.error = "Select a category"; valid = false }
        if (location.isBlank()) { binding.tilLocation.error = "Enter farm location"; valid = false }
        if (!valid) return

        viewModel.createProduct(
            name, description, price!!, marketPrice!!, quantity!!,
            category, location, freshness, selectedImageFile
        )
    }

    private fun uriToFile(uri: Uri): File? {
        return try {
            val inputStream = requireContext().contentResolver.openInputStream(uri) ?: return null
            val tempFile = File.createTempFile("crop_image_", ".jpg", requireContext().cacheDir)
            tempFile.outputStream().use { inputStream.copyTo(it) }
            tempFile
        } catch (e: Exception) { null }
    }

    private fun observeViewModel() {
        viewModel.createProductState.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Loading -> {
                    binding.progressBar.show()
                    binding.btnSave.isEnabled = false
                    binding.btnSave.text = "Saving…"
                }
                is Resource.Success -> {
                    binding.progressBar.hide()
                    binding.btnSave.isEnabled = true
                    binding.btnSave.text = getString(R.string.save_crop)
                    toast("Crop added successfully! 🌾")
                    findNavController().navigateUp()
                }
                is Resource.Error -> {
                    binding.progressBar.hide()
                    binding.btnSave.isEnabled = true
                    binding.btnSave.text = getString(R.string.save_crop)
                    toast(state.message)
                }
                else -> {
                    binding.progressBar.hide()
                    binding.btnSave.isEnabled = true
                }
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
