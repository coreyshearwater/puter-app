from PIL import Image, ImageOps, ImageFilter

def process_icon():
    try:
        # Open source image
        img = Image.open('cat-icon-1024-transparent5.png').convert("RGBA")
        
        # Create new 1024x1024 transparent canvas
        size = (1024, 1024)
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        
        # Remove padding to maximize icon size in taskbar
        target_size = 1024 # 100% usage
        
        # Resize image maintaining aspect ratio
        img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
        
        # Calculate centering position
        x = (1024 - img.width) // 2
        y = (1024 - img.height) // 2
        
        # Paste the resized image onto the canvas
        canvas.paste(img, (x, y), img)
        
        # Save as new file
        canvas.save('app-icon-1024.png', 'PNG')
        print("Success: app-icon-1024.png created with 10% padding.")
        
    except Exception as e:
        print(f"Error processing icon: {e}")

if __name__ == "__main__":
    process_icon()
