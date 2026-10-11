import json,sys
for l in open(sys.argv[1]):
    try: j=json.loads(l)
    except: print("RAW",l[:300]); continue
    if j['type']=='tool_use':
        p=j['part']; print("TOOL",p.get('tool'), p['state'].get('status'), json.dumps(p['state'].get('input'))[:250])
    elif j['type']=='error': print("ERROR", json.dumps(j)[:600])
