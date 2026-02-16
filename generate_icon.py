from PIL import Image, ImageDraw

def create_icon():
    size = (256, 256)
    # Dark background #1a1a25 to #05050a gradient approximation
    # Simplified to dark fill
    bg_color = (10, 10, 15) 
    cyan = (0, 255, 247)
    black = (0, 0, 0)
    white = (255, 255, 255)

    img = Image.new('RGBA', size, bg_color)
    draw = ImageDraw.Draw(img)

    # Rounded rect background
    # Pillow doesn't have easy rounded rect with gradient, so flat dark
    draw.rounded_rectangle([(0,0), size], radius=50, fill=bg_color)

    # Eye shape (simplified almond)
    center_x, center_y = size[0]//2, size[1]//2
    eye_width = 180
    eye_height = 100
    
    # Outer eye (cyan stroke, dark fill)
    # Using arc or polygon
    # Let's use ellipse for simplicity
    draw.ellipse([center_x - eye_width//2, center_y - eye_height//2, 
                  center_x + eye_width//2, center_y + eye_height//2], 
                 outline=cyan, width=8)

    # Iris
    iris_r = 50
    draw.ellipse([center_x - iris_r, center_y - iris_r,
                  center_x + iris_r, center_y + iris_r],
                 fill=cyan)

    # Pupil 1 (Left)
    pupil_r = 12
    draw.ellipse([center_x - 20 - pupil_r, center_y - pupil_r,
                  center_x - 20 + pupil_r, center_y + pupil_r],
                 fill=black)

    # Pupil 2 (Right)
    draw.ellipse([center_x + 20 - pupil_r, center_y - pupil_r,
                  center_x + 20 + pupil_r, center_y + pupil_r],
                 fill=black)

    # Shine
    draw.ellipse([center_x + 30, center_y - 30, center_x + 40, center_y - 20], fill=(255,255,255, 150))

    img.save('app_icon.png')
    img.save('favicon.ico', format='ICO', sizes=[(256, 256)])
    print("Icon created: app_icon.png, favicon.ico")

if __name__ == '__main__':
    create_icon()
