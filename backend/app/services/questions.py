TEMPLATE_LANGS = {"en", "hi", "hinglish"}

QUESTION_TEXT = {
    "fraud_type": {
        "en": ("Could you tell me what happened? Take your time.",
               "In a sentence or two, how did the money go? For example, a call, a link or an app."),
        "hi": ("आप आराम से बताइए, क्या हुआ?",
               "थोड़े में बताइए, पैसे कैसे गए? जैसे कोई कॉल, लिंक या ऐप।"),
        "hinglish": ("आप आराम से बताइए, क्या हुआ?",
                     "थोड़े में बताइए, पैसे कैसे गए? जैसे कोई call, link या app।"),
    },
    "bank_or_payment_app": {
        "en": ("Which bank or payment app did the money go from?",
               "Which bank, or which app, like PhonePe, Google Pay or Paytm?"),
        "hi": ("पैसे किस बैंक या पेमेंट ऐप से गए?",
               "कौन सा बैंक, या कौन सा ऐप, जैसे PhonePe, Google Pay या Paytm?"),
        "hinglish": ("पैसे किस bank या payment app से गए?",
                     "कौन सा bank, या कौन सा app, जैसे PhonePe, Google Pay या Paytm?"),
    },
    "amount_inr": {
        "en": ("About how much money was taken?",
               "Roughly how many rupees? An estimate is fine, like fifty thousand."),
        "hi": ("कितने रुपये निकले?",
               "लगभग कितने रुपये? अंदाज़ा भी चलेगा, जैसे पचास हज़ार।"),
        "hinglish": ("कितने rupees निकले?",
                     "लगभग कितने rupees? अंदाज़ा भी चलेगा, जैसे पचास हज़ार।"),
    },
    "transaction_reference": {
        "en": ("What is the transaction ID? You can find it in your payment app or the bank's SMS.",
               "Please read the transaction ID slowly, digit by digit. If you can't find it, just say skip."),
        "hi": ("ट्रांज़ैक्शन ID क्या है? वह आपके पेमेंट ऐप या बैंक के SMS में मिल जाएगी।",
               "कृपया ट्रांज़ैक्शन ID धीरे-धीरे, एक-एक अंक करके बोलिए। न मिले तो 'छोड़िए' कह दीजिए।"),
        "hinglish": ("Transaction ID क्या है? वह आपके payment app या bank के SMS में मिल जाएगी।",
                     "कृपया ID धीरे-धीरे, एक-एक digit करके बोलिए। न मिले तो 'skip' कह दीजिए।"),
    },
    "incident_date": {
        "en": ("On which date did this happen?",
               "Which day was it? You can say yesterday, or a date like 21 October."),
        "hi": ("यह किस तारीख को हुआ?",
               "कौन सा दिन था? आप कल, या 21 अक्टूबर जैसी तारीख बोल सकते हैं।"),
        "hinglish": ("यह किस date को हुआ?",
                     "कौन सा दिन था? आप कल, या 21 October जैसी date बोल सकते हैं।"),
    },
    "incident_time": {
        "en": ("Around what time was it?",
               "Roughly what time? For example, half past four in the evening."),
        "hi": ("लगभग किस समय हुआ?",
               "लगभग कितने बजे? जैसे शाम के साढ़े चार बजे।"),
        "hinglish": ("लगभग किस time हुआ?",
                     "लगभग कितने बजे? जैसे शाम के साढ़े चार बजे।"),
    },
    "registered_phone_last4": {
        "en": ("What are the last four digits of your registered mobile number?",
               "Just the last four digits of the number linked to your bank, please."),
        "hi": ("आपके रजिस्टर्ड मोबाइल नंबर के आख़िरी चार अंक क्या हैं?",
               "बैंक से जुड़े नंबर के बस आख़िरी चार अंक बताइए।"),
        "hinglish": ("आपके registered mobile number के आख़िरी चार digits क्या हैं?",
                     "Bank से जुड़े number के बस आख़िरी चार digits बताइए।"),
    },
    "otp_or_pin_shared": {
        "en": ("Did you share an OTP or PIN with anyone? Please don't tell me the code itself.",
               "Just yes or no: did anyone get your OTP or PIN? Not the code, only yes or no."),
        "hi": ("क्या आपने किसी को OTP या PIN बताया? कोड मत बताइएगा, बस हाँ या नहीं।",
               "बस हाँ या नहीं: क्या किसी को आपका OTP या PIN मिला? कोड नहीं बताना है।"),
        "hinglish": ("क्या आपने किसी को OTP या PIN बताया? Code मत बताइएगा, बस हाँ या नहीं।",
                     "बस हाँ या नहीं: क्या किसी को आपका OTP या PIN मिला? Code नहीं बताना है।"),
    },
    "contacted_bank": {
        "en": ("Have you already told your bank or payment app about this?",
               "Did you call or message your bank about it yet? Yes or no is fine."),
        "hi": ("क्या आपने इस बारे में अपने बैंक या ऐप को बताया है?",
               "क्या आपने बैंक को कॉल या मैसेज किया? हाँ या नहीं बता दीजिए।"),
        "hinglish": ("क्या आपने इस बारे में अपने bank या app को बताया है?",
                     "क्या आपने bank को call या message किया? हाँ या नहीं बता दीजिए।"),
    },
    "caller_name": {
        "en": ("And may I have your name, please?",
               "Your name, just for the report. You can skip if you prefer."),
        "hi": ("और आपका नाम क्या है?",
               "रिपोर्ट के लिए बस आपका नाम। आप चाहें तो छोड़ सकते हैं।"),
        "hinglish": ("और आपका नाम क्या है?",
                     "Report के लिए बस आपका नाम। आप चाहें तो skip कर सकते हैं।"),
    },
}

REDIRECT = {
    "en": "I can only help with the details of the fraud.",
    "hi": "मैं सिर्फ़ धोखाधड़ी की जानकारी में आपकी मदद कर सकती हूँ।",
    "hinglish": "मैं सिर्फ़ fraud की details में आपकी मदद कर सकती हूँ।",
}

HANDOFF = {
    "en": "I can't help further here. Please call 1930, or ask for a human operator.",
    "hi": "मैं यहाँ इससे आगे मदद नहीं कर सकती। कृपया 1930 पर कॉल कीजिए, या किसी ऑपरेटर से बात कीजिए।",
    "hinglish": "मैं यहाँ इससे आगे मदद नहीं कर सकती। कृपया 1930 पर call कीजिए, या किसी human operator से बात कीजिए।",
}

SORRY = {
    "en": "Sorry, I didn't catch that clearly.",
    "hi": "माफ़ कीजिए, यह साफ़ सुनाई नहीं दिया।",
    "hinglish": "Sorry, यह clearly सुनाई नहीं दिया।",
}

SECRET_NOTICE = {
    "en": "Please don't share secret codes or PINs with me. I won't include it in your report.",
    "hi": "कृपया कोई गुप्त कोड या PIN मुझे न बताइए। मैं उसे आपकी रिपोर्ट में शामिल नहीं करूँगी।",
    "hinglish": "कृपया कोई secret code या PIN मुझे मत बताइए। मैं उसे आपकी report में शामिल नहीं करूँगी।",
}

WRAPUP = {
    "en": "That's everything the team needs. I'll show your details on screen now, so you can check them and send the report.",
    "hi": "टीम को जो चाहिए था, वह सब मिल गया है। अब मैं आपकी जानकारी स्क्रीन पर दिखा रही हूँ, आप उसे देखकर रिपोर्ट भेज दीजिए।",
    "hinglish": "Team को जो चाहिए था, वह सब मिल गया है। अब मैं आपके details screen पर दिखा रही हूँ, आप check करके report भेज दीजिए।",
}

ALERT = {
    "danger": {
        "en": "If you are in immediate danger, please call 112 right now. I can also connect you to a human operator.",
        "hi": "अगर आप तुरंत ख़तरे में हैं तो अभी 112 पर कॉल कीजिए। मैं आपको किसी ऑपरेटर से भी जोड़ सकती हूँ।",
        "hinglish": "अगर आप तुरंत danger में हैं तो अभी 112 पर call कीजिए। मैं आपको किसी human operator से भी जोड़ सकती हूँ।",
    },
    "no_money_lost": {
        "en": "This assistant is only for money lost to online fraud. Please visit cybercrime.gov.in, or ask for a human operator.",
        "hi": "यह असिस्टेंट सिर्फ़ ऑनलाइन धोखाधड़ी में गए पैसों के लिए है। कृपया cybercrime.gov.in देखिए, या किसी ऑपरेटर से बात कीजिए।",
        "hinglish": "यह assistant सिर्फ़ online fraud में गए पैसों के लिए है। कृपया cybercrime.gov.in देखिए, या किसी human operator से बात कीजिए।",
    },
}


def pick(table: dict, lang: str) -> str:
    return table.get(lang) or table["en"]