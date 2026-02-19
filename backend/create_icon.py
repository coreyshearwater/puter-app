from PIL import Image
import os

def create_square_icon(input_path, output_path):
    try:
        img = Image.open(input_path)
        # Create a square canvas with transparent background
        max_dim = max(img.size)
        square_img = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
        
        # Center the original image on the square canvas
        offset_x = (max_dim - img.size[0]) // 2
        offset_y = (max_dim - img.size[1]) // 2
        square_img.paste(img, (offset_x, offset_y))
        
        # Save as ICO with multiple sizes
        square_img.save(output_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
        print(f"SUCCESS: {output_path} created from {input_path} (padded to square).")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    create_square_icon("cat-icon-1024-transparent5.png", "icon.ico")
