package com.kisaanconnect.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import androidx.viewpager2.widget.ViewPager2
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentOnboardingBinding
import com.kisaanconnect.databinding.FragmentOnboardingPageBinding

data class OnboardingPage(val title: String, val description: String, val imageRes: Int, val bgColor: Int)

class OnboardingFragment : Fragment() {

    private var _binding: FragmentOnboardingBinding? = null
    private val binding get() = _binding!!

    private val pages = listOf(
        OnboardingPage("Fresh From Farm", "Get farm-fresh vegetables, fruits and grains directly from verified farmers across India.", R.drawable.logo, R.color.brand_green_50),
        OnboardingPage("Fair Prices Always", "No middlemen. Farmers earn more, you pay less. Transparent pricing powered by real market data.", R.drawable.logo, R.color.brand_amber_light),
        OnboardingPage("AI-Powered Agriculture", "Smart crop disease detection, weather forecasts, and AI assistant to help farmers grow better.", R.drawable.logo, R.color.md_theme_light_tertiaryContainer)
    )

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOnboardingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.viewPager.adapter = OnboardingPagerAdapter(this, pages)
        binding.indicator.setViewPager(binding.viewPager)

        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                val isLast = position == pages.size - 1
                binding.btnNext.text = if (isLast) "Get Started" else "Next"
                binding.btnSkip.visibility = if (isLast) View.GONE else View.VISIBLE
            }
        })

        binding.btnNext.setOnClickListener {
            val current = binding.viewPager.currentItem
            if (current < pages.size - 1) {
                binding.viewPager.currentItem = current + 1
            } else {
                completeOnboarding()
            }
        }

        binding.btnSkip.setOnClickListener { completeOnboarding() }
    }

    private fun completeOnboarding() {
        KisaanApp.instance.prefs.isOnboarded = true
        requireActivity().supportFragmentManager.beginTransaction()
            .replace(R.id.auth_nav_host, LoginFragment())
            .commit()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

class OnboardingPagerAdapter(fragment: Fragment, private val pages: List<OnboardingPage>) :
    FragmentStateAdapter(fragment) {
    override fun getItemCount() = pages.size
    override fun createFragment(position: Int) = OnboardingPageFragment.newInstance(pages[position])
}

class OnboardingPageFragment : Fragment() {
    private var _binding: FragmentOnboardingPageBinding? = null
    private val binding get() = _binding!!

    companion object {
        fun newInstance(page: OnboardingPage) = OnboardingPageFragment().apply {
            arguments = Bundle().apply {
                putString("title", page.title)
                putString("desc", page.description)
                putInt("image", page.imageRes)
                putInt("bg", page.bgColor)
            }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOnboardingPageBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        arguments?.let {
            binding.tvTitle.text = it.getString("title")
            binding.tvDescription.text = it.getString("desc")
            binding.ivIllustration.setImageResource(it.getInt("image", R.drawable.logo))
            binding.root.setBackgroundColor(requireContext().getColor(it.getInt("bg", R.color.brand_green_50)))
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
