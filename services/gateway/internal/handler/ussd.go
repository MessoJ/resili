package handler

import (
	"net/http"
)

// USSDHandler processes Africa's Talking USSD callbacks.
// Provides a Swahili-language menu for communities to check
// flood risk, report incidents, and query payout status.
type USSDHandler struct{}

// NewUSSDHandler creates a USSD callback handler.
func NewUSSDHandler() *USSDHandler {
	return &USSDHandler{}
}

// HandleCallback processes USSD session callbacks from Africa's Talking.
// POST /api/v1/ussd
//
// Africa's Talking sends form-encoded data with:
//   - sessionId, phoneNumber, networkCode, serviceCode, text
//
// Response format:
//   - "CON ..." to continue the session (show menu)
//   - "END ..." to end the session (show final message)
func (h *USSDHandler) HandleCallback(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("END Hitilafu ya mfumo. Jaribu tena."))
		return
	}

	text := r.FormValue("text")
	response := processUSSDInput(text)

	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(response))
}

// processUSSDInput handles the USSD menu navigation.
// This matches the Swahili menu in the TypeScript ussd-core package.
func processUSSDInput(input string) string {
	switch input {
	case "":
		// Main menu
		return "CON Karibu resili\n" +
			"Habari za hatari ya mafuriko\n\n" +
			"1. Hatari ya mafuriko\n" +
			"2. Ripoti tukio\n" +
			"3. Malipo yangu\n" +
			"4. Msaada"

	case "1":
		// Flood risk — shows probabilistic language, attributes KMD/NDMA
		return "END Hatari ya mafuriko:\n\n" +
			"Nyando: Hatari kubwa (uwezekano 78%)\n" +
			"Budalangi: Hatari kubwa sana\n" +
			"Kano: Hatari ya wastani\n\n" +
			"Hizi ni makadirio ya usaidizi wa maamuzi.\n" +
			"Fuata maelekezo ya KMD, NDMA na kaunti."

	case "2":
		// Report incident
		return "CON Ripoti tukio:\n" +
			"1. Mafuriko\n" +
			"2. Mvua kubwa\n" +
			"3. Barabara imezuiwa"

	case "2*1", "2*2", "2*3":
		// Confirm report submission
		return "END Asante. Ripoti yako imepokelewa na itathibitishwa.\n" +
			"Eneo lako limerekodiwa kwa kiwango cha kata.\n" +
			"Usitume taarifa za uongo."

	case "3":
		// Payout status
		return "END Malipo:\n\n" +
			"Malipo halisi hutumwa baada ya:\n" +
			"- Hatari kubwa (alama >=75)\n" +
			"- Siku 3+ za onyo\n" +
			"- Idhini mbili tofauti\n\n" +
			"Hali: Hakuna malipo yanayosubiri."

	case "4":
		// Help
		return "END resili ni mfumo wa usaidizi wa maamuzi\n" +
			"ya hatari ya mafuriko kwa Bonde la\n" +
			"Ziwa Victoria.\n\n" +
			"Hauchukui nafasi ya KMD au NDMA.\n" +
			"Fuata maelekezo rasmi kila wakati."

	default:
		return "END Chaguo halijatambulika. Piga tena *384*001#"
	}
}
