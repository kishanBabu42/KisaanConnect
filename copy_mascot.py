import shutil
import os

src = r'C:\Users\DHANUNJAY\.gemini\antigravity\brain\c281933b-441c-455c-a043-3c5e23d3bfd3\farmer_mascot_1775877483051.png'
dest = r'farmer-mascot.png'

try:
    shutil.copy2(src, dest)
    print(f'Successfully copied to {dest}')
except Exception as e:
    print(f'Error: {e}')
