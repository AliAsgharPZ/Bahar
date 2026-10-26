#!/usr/bin/env python3
"""Generate reference QR matrices with Python `qrcode` lib for comparison."""
import json, sys
import qrcode

cases = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
ECL = {
    "LOW": qrcode.constants.ERROR_CORRECT_L,
    "MEDIUM": qrcode.constants.ERROR_CORRECT_M,
    "QUARTILE": qrcode.constants.ERROR_CORRECT_Q,
    "HIGH": qrcode.constants.ERROR_CORRECT_H,
}
out = []
for c in cases:
    qr = qrcode.QRCode(error_correction=ECL[c["ecl"]], border=0)
    qr.add_data(c["text"])
    qr.make(fit=True)
    m = qr.get_matrix()  # list of rows, True=dark
    out.append({
        "text": c["text"],
        "ecl": c["ecl"],
        "size": len(m),
        "matrix": ["".join("1" if v else "0" for v in row) for row in m],
        "version": qr.version,
    })
print(json.dumps(out))
