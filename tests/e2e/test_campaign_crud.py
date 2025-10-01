import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
import time

@pytest.fixture(scope="module")
def driver():
    options = webdriver.ChromeOptions()
    # Quitar el modo headless para ver el navegador
    # options.add_argument('--headless')
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(5)
    yield driver
    driver.quit()

def login(driver, username, password):
    driver.get("http://localhost:5173/login")
    user_input = driver.find_element(By.NAME, "username")
    pass_input = driver.find_element(By.NAME, "password")
    user_input.send_keys(username)
    pass_input.send_keys(password)
    login_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    login_btn.click()
    time.sleep(1)

def test_create_campaign(driver):
    # Cambia estos valores por un usuario de pruebas válido
    username = "testuser"
    password = "testpass"
    print("[TEST] Iniciando test de creación de campaña...")
    login(driver, username, password)
    print("[TEST] Login realizado correctamente.")
    wait = WebDriverWait(driver, 10)
    # Espera a que el sidebar esté visible y haz click en "Campañas"
    print("[TEST] Navegando a la sección de campañas...")
    sidebar_campaigns = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Campañas') or contains(text(), 'Campaigns')]") )
    )
    sidebar_campaigns.click()
    print("[TEST] Click en 'Campañas' realizado.")
    # Espera a que el botón "Nueva campaña" esté visible
    new_campaign_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Nueva campaña') or contains(., 'New campaign')]") )
    )
    new_campaign_btn.click()
    print("[TEST] Click en 'Nueva campaña' realizado.")
    # Espera a que el input de nombre esté visible (más flexible)
    name_input = wait.until(
        EC.visibility_of_element_located((By.XPATH, "//div[contains(@role, 'dialog')]//input[@type='text']"))
    )
    print("[TEST] Modal de nueva campaña abierto.")
    name_input.clear()
    name_input.send_keys("Campaña Selenium")
    desc_input = driver.find_element(By.XPATH, "//div[contains(@role, 'dialog')]//textarea")
    desc_input.clear()
    desc_input.send_keys("Descripción de prueba automatizada.")
    print("[TEST] Formulario de campaña rellenado.")
    # Pulsa guardar
    save_btn = wait.until(
        EC.presence_of_element_located((By.XPATH, "//button[@type='submit' and (contains(., 'Guardar') or contains(., 'Save'))]"))
    )
    print(f"[TEST] Estado del botón Guardar: enabled={save_btn.is_enabled()}, displayed={save_btn.is_displayed()}")
    if not save_btn.is_enabled():
        raise Exception("[ERROR] El botón Guardar está deshabilitado. Verifica los campos obligatorios.")
    save_btn.click()
    print("[TEST] Click en 'Guardar' realizado.")
    # Espera un poco para que el frontend refresque
    time.sleep(1)
    # Espera a que la campaña aparezca en la lista
    wait.until(lambda d: "Campaña Selenium" in d.page_source)
    print("[TEST] Campaña creada y visible en la lista.")
    assert "Campaña Selenium" in driver.page_source
    print("[TEST] TEST PASADO: Creación de campaña exitosa.")
