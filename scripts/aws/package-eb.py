"""Gera o zip do Elastic Beanstalk: build pronto (dist/), package*.json, CA do RDS, Procfile e hooks.

Uso: npm run build && python scripts/aws/package-eb.py <saida.zip>
Nunca inclui .env: as variáveis ficam na configuração do ambiente.
"""
import pathlib
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / 'eb-bundle.zip')

files = [p for p in (root / 'dist').rglob('*') if p.is_file()]
files += [p for p in (root / '.platform').rglob('*') if p.is_file()]
files += [root / n for n in ('package.json', 'package-lock.json', 'Procfile', 'server/db/certs/rds-global-bundle.pem')]

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        name = f.relative_to(root).as_posix()
        info = zipfile.ZipInfo.from_file(f, name)
        # Hooks precisam do bit de execução; no Windows o arquivo não traz permissão Unix.
        mode = 0o755 if name.endswith('.sh') else 0o644
        info.external_attr = (0o100000 | mode) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, f.read_bytes().replace(b'\r\n', b'\n') if name.endswith('.sh') or name == 'Procfile' else f.read_bytes())

print(f'{out} ({len(files)} arquivos, {out.stat().st_size / 1e6:.2f} MB)')
