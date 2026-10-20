try {
    Write-Host "Tentando conectar ao After Effects via COM Object..."
    $ae = New-Object -ComObject "AfterEffects.Application"
    if ($ae) {
        Write-Host "Objeto COM AfterEffects.Application instanciado com sucesso!"
        $jsx = 'var f = new File("C:/Users/claud/AppData/Local/Temp/ae_com_test.txt"); f.open("w"); f.write("COM_WORKS"); f.close();'
        $ae.DoScript($jsx)
        Write-Host "DoScript executado. Verificando arquivo..."
        $exists = Test-Path "C:\Users\claud\AppData\Local\Temp\ae_com_test.txt"
        Write-Host "Resultado do arquivo criado: $exists"
    }
} catch {
    Write-Host "Erro COM: $($_.Exception.Message)"
}
