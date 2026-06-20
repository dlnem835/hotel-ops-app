import { L, stdCategory, stdItem } from "./builders";
import { StandardTemplateDefinition } from "./types";

export const HK_VACANT_READY: StandardTemplateDefinition = {
  key: "hk-vacant-ready",
  version: "1.1",
  name: "Housekeeping Vacant Ready",
  templateType: "Guest Room",
  description: "Complete vacant-room readiness checklist for guest arrival.",
  categories: [
    stdCategory("entry", L("Entry", "Entrada"), [
      stdItem(
        "door",
        L(
          "Door: Is the peephole, door, door frame and door lock clean?",
          "Puerta: ¿Están limpios el mirilla, la puerta, el marco y la cerradura?"
        ),
        3
      ),
      stdItem(
        "floor",
        L(
          "Floor: Have the carpet edges been vacuumed around the door?",
          "Piso: ¿Se aspiraron los bordes de la alfombra alrededor de la puerta?"
        ),
        3
      ),
      stdItem(
        "smell",
        L(
          "Fresh, Clean, Neutral Smell: Does the room smell fresh and clean upon entering the room?",
          "Olor fresco y limpio: ¿La habitación huele fresca y limpia al entrar?"
        ),
        3
      ),
      stdItem(
        "temperature",
        L(
          "Correct Temperature: Is the temperature set correctly?",
          "Temperatura correcta: ¿Está la temperatura configurada correctamente?"
        ),
        3
      ),
    ]),
    stdCategory("closet", L("Closet", "Closet"), [
      stdItem(
        "hangers",
        L(
          "Hangers: Are the correct number of hangers present?",
          "Ganchos: ¿Hay la cantidad correcta de ganchos?"
        ),
        3
      ),
      stdItem(
        "laundry-bag",
        L(
          "Laundry Bag/Ticket: Is the laundry bag and ticket present?",
          "Bolsa/Boleta de lavandería: ¿Están presentes la bolsa y la boleta?"
        ),
        3
      ),
      stdItem(
        "iron",
        L(
          "Iron: Is the iron clean, no water?",
          "Plancha: ¿Está la plancha limpia y sin agua?"
        ),
        3
      ),
      stdItem(
        "ironing-board",
        L(
          "Ironing Board: Is the ironing board clean with cover, caps on all legs?",
          "Tabla de planchar: ¿Está limpia con funda y tapones en todas las patas?"
        ),
        3
      ),
      stdItem(
        "linen-bag",
        L(
          "Linen Storage Bag: Is the vinyl zipper linen storage bag present, neat, and with pillow included?",
          "Bolsa de lino: ¿Está presente, ordenada y con almohada incluida?"
        ),
        3
      ),
    ]),
    stdCategory("bedroom", L("Bedroom", "Dormitorio"), [
      stdItem(
        "bed",
        L(
          "Bed: Is the bed made correctly with clean linens, proper turndown, and no wrinkles?",
          "Cama: ¿Está bien hecha con ropa limpia, sin arrugas?"
        ),
        5
      ),
      stdItem(
        "pillows",
        L(
          "Pillows/Bedding: Are pillows fluffed, pillowcases clean, and bedspread even?",
          "Almohadas/Ropa de cama: ¿Almohadas esponjadas, fundas limpias y cobertor parejo?"
        ),
        3
      ),
      stdItem(
        "nightstands",
        L(
          "Nightstands: Are nightstands clean, dust-free, and properly staged?",
          "Mesitas de noche: ¿Están limpias, sin polvo y bien presentadas?"
        ),
        3
      ),
      stdItem(
        "lamps",
        L(
          "Lamps: Are bedside and desk lamps clean, working, and shade aligned?",
          "Lámparas: ¿Están limpias, funcionando y con pantalla alineada?"
        ),
        3
      ),
      stdItem(
        "tv-remote",
        L(
          "TV & Remote: Is the TV clean, operational, and the remote sanitized and present?",
          "TV y control: ¿TV limpio, operativo y control desinfectado y presente?"
        ),
        3
      ),
      stdItem(
        "furniture",
        L(
          "Furniture: Are dressers, chairs, and desk clean with no dust or stains?",
          "Muebles: ¿Cómodas, sillas y escritorio limpios sin polvo ni manchas?"
        ),
        3
      ),
      stdItem(
        "trash",
        L(
          "Trash: Are wastebaskets empty with new liners?",
          "Basura: ¿Papeleras vacías con bolsas nuevas?"
        ),
        2
      ),
      stdItem(
        "carpet",
        L(
          "Carpet/Floor: Is the bedroom carpet vacuumed with no debris or stains visible?",
          "Alfombra/Piso: ¿Alfombra aspirada sin residuos ni manchas visibles?"
        ),
        5
      ),
    ]),
    stdCategory("bath", L("Bath", "Baño"), [
      stdItem(
        "vanity",
        L(
          "Vanity/Sink: Is the vanity, sink, and faucet clean and free of hair or residue?",
          "Vanidad/Lavabo: ¿Vanidad, lavabo y grifo limpios sin cabello ni residuo?"
        ),
        5
      ),
      stdItem(
        "shower-tub",
        L(
          "Shower/Tub: Are shower walls, tub, and fixtures clean with no mold or soap buildup?",
          "Ducha/Tina: ¿Paredes, tina y accesorios limpios sin moho ni jabón acumulado?"
        ),
        5
      ),
      stdItem(
        "shower-curtain",
        L(
          "Shower Curtain/Doors: Are shower doors or curtain clean, aligned, and mildew-free?",
          "Puertas/Cortina de ducha: ¿Limpias, alineadas y sin moho?"
        ),
        3
      ),
      stdItem(
        "toilet",
        L(
          "Toilet: Is the toilet bowl, tank, seat, and handle clean and sanitized?",
          "Inodoro: ¿Taza, tanque, asiento y palanca limpios y desinfectados?"
        ),
        5
      ),
      stdItem(
        "towels",
        L(
          "Towels: Are bath towels, hand towels, and washcloths folded and staged correctly?",
          "Toallas: ¿Toallas de baño, de mano y toallitas dobladas y presentadas correctamente?"
        ),
        5
      ),
      stdItem(
        "amenities",
        L(
          "Amenities: Are soap, shampoo, conditioner, lotion, and tissue fully stocked?",
          "Amenidades: ¿Jabón, shampoo, acondicionador, loción y tissue completamente abastecidos?"
        ),
        5
      ),
      stdItem(
        "mirror",
        L(
          "Mirror: Is the mirror streak-free and free of spots?",
          "Espejo: ¿Sin rayas ni manchas?"
        ),
        3
      ),
      stdItem(
        "bath-floor",
        L(
          "Bath Floor: Is the bathroom floor clean, dry, and free of hair?",
          "Piso del baño: ¿Limpio, seco y sin cabello?"
        ),
        5
      ),
      stdItem(
        "caulking",
        L(
          "Caulking/Grout: Is caulking and grout clean and in good condition?",
          "Sellador/Lechada: ¿Limpios y en buen estado?"
        ),
        3
      ),
      stdItem(
        "exhaust-fan",
        L(
          "Exhaust Fan: Is the bathroom exhaust fan clean and operational?",
          "Extractor: ¿Ventilador del baño limpio y operativo?"
        ),
        2
      ),
    ]),
    stdCategory("windows-drapes", L("Windows & Drapes", "Ventanas y cortinas"), [
      stdItem(
        "windows",
        L(
          "Windows: Are windows clean, streak-free, and operational?",
          "Ventanas: ¿Limpias, sin rayas y operativas?"
        ),
        3
      ),
      stdItem(
        "drapes",
        L(
          "Drapes/Sheers: Are drapes and sheers aligned, clean, and free of stains?",
          "Cortinas/Visillos: ¿Alineados, limpios y sin manchas?"
        ),
        3
      ),
      stdItem(
        "window-sills",
        L(
          "Window Sills: Are window sills and tracks clean and dust-free?",
          "Alfeizares: ¿Alfeizares y rieles limpios y sin polvo?"
        ),
        3
      ),
    ]),
    stdCategory("work-area", L("Work Area", "Área de trabajo"), [
      stdItem(
        "desk-chair",
        L(
          "Desk/Chair: Is the desk and chair clean, stable, and properly positioned?",
          "Escritorio/Silla: ¿Limpios, estables y bien posicionados?"
        ),
        3
      ),
      stdItem(
        "desk-lamp",
        L(
          "Desk Lamp: Is the desk lamp clean and working?",
          "Lámpara de escritorio: ¿Limpia y funcionando?"
        ),
        2
      ),
      stdItem(
        "notepad",
        L(
          "Notepad/Pen: Are notepad and pen present and usable?",
          "Bloc/Lápiz: ¿Bloc y lápiz presentes y usables?"
        ),
        2
      ),
      stdItem(
        "wifi",
        L(
          "Wi-Fi Info: Is Wi-Fi information visible and current?",
          "Info Wi-Fi: ¿Información de Wi-Fi visible y actualizada?"
        ),
        2
      ),
    ]),
    stdCategory("amenities-supplies", L("Amenities & Supplies", "Amenidades y suministros"), [
      stdItem(
        "coffee",
        L(
          "Coffee/Tea Station: Is the coffee maker clean with cups, coffee, and supplies stocked?",
          "Estación de café/té: ¿Cafetera limpia con tazas, café y suministros abastecidos?"
        ),
        5
      ),
      stdItem(
        "ice-bucket",
        L(
          "Ice Bucket/Glasses: Are ice bucket, liner, and glasses clean and present?",
          "Cubeta/Vasos: ¿Cubeta de hielo, bolsa y vasos limpios y presentes?"
        ),
        3
      ),
      stdItem(
        "guest-directory",
        L(
          "Guest Directory: Is the guest directory/folio holder clean and correctly placed?",
          "Directorio: ¿Directorio/portafolio limpio y colocado correctamente?"
        ),
        2
      ),
      stdItem(
        "micro-fridge",
        L(
          "Microwave/Refrigerator: Are microwave and refrigerator clean, empty, and operational?",
          "Micro/Refrigerador: ¿Limpios, vacíos y operativos?"
        ),
        5
      ),
      stdItem(
        "safe",
        L(
          "Safe: Is the in-room safe clean, operational, and reset?",
          "Caja fuerte: ¿Limpia, operativa y restablecida?"
        ),
        3
      ),
    ]),
    stdCategory("overall-room", L("Overall Room", "Habitación en general"), [
      stdItem(
        "walls-ceiling",
        L(
          "Walls/Ceiling: Are walls and ceiling clean with no marks, scuffs, or cobwebs?",
          "Paredes/Techo: ¿Limpios sin marcas, raspones ni telarañas?"
        ),
        3
      ),
      stdItem(
        "baseboards",
        L(
          "Baseboards: Are baseboards clean and free of dust?",
          "Zócalos: ¿Limpios y sin polvo?"
        ),
        3
      ),
      stdItem(
        "artwork",
        L(
          "Artwork/Mirrors: Is artwork and room mirror clean, secure, and level?",
          "Arte/Espejos: ¿Arte y espejo limpios, seguros y nivelados?"
        ),
        3
      ),
      stdItem(
        "hvac",
        L(
          "HVAC: Is the thermostat set correctly and vents clean and unobstructed?",
          "HVAC: ¿Termostato correcto y rejillas limpias y despejadas?"
        ),
        3
      ),
      stdItem(
        "lighting",
        L(
          "Lighting: Do all room lights work including closet and bathroom?",
          "Iluminación: ¿Todas las luces funcionan incluyendo closet y baño?"
        ),
        3
      ),
      stdItem(
        "phone",
        L(
          "Phone: Is the phone clean, working, and message light reset?",
          "Teléfono: ¿Limpio, funcionando y luz de mensaje restablecida?"
        ),
        2
      ),
      stdItem(
        "smoke-detector",
        L(
          "Smoke Detector: Is the smoke detector present, unobstructed, and indicator normal?",
          "Detector de humo: ¿Presente, despejado e indicador normal?"
        ),
        5
      ),
    ]),
    stdCategory("housekeeping-cart", L("Housekeeping Cart", "Carrito de limpieza"), [
      stdItem(
        "clean-organized-cart",
        L(
          "Clean Organized Cart: Is the attendant's cart clean and organized, trash separated from clean and dirty linens, chemicals away from linens?",
          "Carrito limpio y organizado: ¿Está el carrito del camarista limpio y organizado, basura separada de ropa limpia y sucia, químicos alejados de la ropa?"
        ),
        3
      ),
    ]),
    stdCategory(
      "evidence-from-past-guest",
      L("Evidence from Past Guest", "Evidencia del huésped anterior"),
      [
        stdItem(
          "hair",
          L(
            "Hair: Is the room free of hair?",
            "Cabello: ¿La habitación está libre de cabello?"
          ),
          40
        ),
        stdItem(
          "trash-debris-food",
          L(
            "Trash / Debris / Food: Is the room free of trash, debris and food?",
            "Basura / Residuos / Comida: ¿La habitación está libre de basura, residuos y comida?"
          ),
          40
        ),
        stdItem(
          "clothes-lost-found",
          L(
            "Clothes / Lost & Found Items: Is the room free of clothes, lost and found items?",
            "Ropa / Objetos perdidos: ¿La habitación está libre de ropa y objetos perdidos?"
          ),
          40
        ),
        stdItem(
          "bodily-fluids",
          L(
            "Bodily Fluids: Is the room free of bodily fluids?",
            "Fluidos corporales: ¿La habitación está libre de fluidos corporales?"
          ),
          40
        ),
        stdItem(
          "bedding-stains",
          L(
            "Bedding Stains: Is the bedding free of stains?",
            "Manchas en ropa de cama: ¿La ropa de cama está libre de manchas?"
          ),
          40
        ),
        stdItem(
          "pests",
          L(
            "Pests / Signs of Pests: Is the room free of pests / signs of pests?",
            "Plagas / Señales de plagas: ¿La habitación está libre de plagas o señales de plagas?"
          ),
          40
        ),
        stdItem(
          "other-evidence",
          L(
            "Other Evidence from Past Guest: Is the room free of all other evidence from past guest?",
            "Otra evidencia del huésped anterior: ¿La habitación está libre de cualquier otra evidencia del huésped anterior?"
          ),
          40
        ),
      ]
    ),
  ],
};
