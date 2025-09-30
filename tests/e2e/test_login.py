import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager

@pytest.fixture(scope="module")
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(5)
    yield driver
    driver.quit()

def test_login(driver):
    driver.get("http://localhost:5173/login")
    # Cambia estos valores por un usuario de pruebas válido
    username = "testuser"
    password = "testpass"
    
    # Busca los campos de usuario y contraseña
    user_input = driver.find_element(By.NAME, "username")
    pass_input = driver.find_element(By.NAME, "password")
    user_input.send_keys(username)
    pass_input.send_keys(password)
    
    # Busca y pulsa el botón de login
    login_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    login_btn.click()
    
    # Espera a que aparezca el texto de bienvenida del Home
    driver.implicitly_wait(5)
    assert (
        "Bienvenido" in driver.page_source
        or "welcome" in driver.page_source
        or "Dungeon Master" in driver.page_source
        or "DM App" in driver.title
    )
