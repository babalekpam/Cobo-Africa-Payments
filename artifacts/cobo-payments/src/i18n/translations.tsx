import { createContext, useContext, useState, type ReactNode } from "react";

export const LANGUAGES: Record<string, { label: string; flag: string; rtl: boolean }> = {
  en: { label: "English", flag: "GB", rtl: false },
  fr: { label: "Francais", flag: "FR", rtl: false },
  pt: { label: "Portugues", flag: "PT", rtl: false },
  ar: { label: "العربية", flag: "SA", rtl: true },
  sw: { label: "Kiswahili", flag: "KE", rtl: false },
};

const T: Record<string, Record<string, string>> = {
  en: {
    dashboard:"Dashboard",wallets:"Wallets",iapay:"IAPAY",send_money:"Send Money",transactions:"Transactions",fx_exchange:"FX Exchange",payment_links:"Payment Links",beneficiaries:"Beneficiaries",verification:"Verification",notifications:"Notifications",merchants:"Merchants",reports:"Reports",developer:"Developer",admin_panel:"Admin Panel",compliance:"Compliance",settings:"Settings",activity_log:"Activity Log",sign_in:"Sign In",sign_out:"Sign Out",create_account:"Create Account",email:"Email address",password:"Password",first_name:"First name",last_name:"Last name",country:"Country",forgot_password:"Forgot password?",reset_password:"Reset Password",new_password:"New password",current_password:"Current password",send_reset_link:"Send Reset Link",back_to_login:"Back to login",send:"Send",receive:"Receive",swap:"Swap",deposit:"Deposit",amount:"Amount",fee:"Fee",total:"Total",balance:"Balance",from_wallet:"From wallet",recipient:"Recipient",account_number:"Account number",bank:"Bank",provider:"Provider",phone:"Phone number",description:"Description",cancel:"Cancel",save:"Save",confirm:"Confirm",copy:"Copy",close:"Close",back:"Back",approve:"Approve",reject:"Reject",success:"Success",pending:"Pending",failed:"Failed",processing:"Processing",verified:"Verified",unverified:"Unverified",active:"Active",kyc_required:"KYC verification required",daily_limit:"Daily limit",complete_kyc:"Complete KYC to increase your limits",two_fa:"Two-Factor Authentication",enable_2fa:"Enable 2FA",disable_2fa:"Disable 2FA",export_csv:"Export CSV",download_receipt:"Download Receipt",print_receipt:"Print Receipt",transfer_initiated:"Transfer Initiated",copied:"Copied!",loading:"Loading...",error:"Something went wrong.",insufficient_balance:"Insufficient balance",good_morning:"Good morning",good_afternoon:"Good afternoon",good_evening:"Good evening",welcome_back:"Welcome back",terms:"Terms of Service",privacy:"Privacy Policy",logout:"Logout",
  },
  fr: {
    dashboard:"Tableau de bord",wallets:"Portefeuilles",send_money:"Envoyer de l'argent",transactions:"Transactions",fx_exchange:"Echange de devises",payment_links:"Liens de paiement",beneficiaries:"Beneficiaires",verification:"Verification",notifications:"Notifications",merchants:"Commercants",reports:"Rapports",developer:"Developpeur",admin_panel:"Panneau admin",compliance:"Conformite",settings:"Parametres",activity_log:"Journal d'activite",sign_in:"Se connecter",sign_out:"Se deconnecter",create_account:"Creer un compte",email:"Adresse e-mail",password:"Mot de passe",first_name:"Prenom",last_name:"Nom de famille",country:"Pays",forgot_password:"Mot de passe oublie ?",reset_password:"Reinitialiser",new_password:"Nouveau mot de passe",current_password:"Mot de passe actuel",send_reset_link:"Envoyer le lien",back_to_login:"Retour a la connexion",send:"Envoyer",receive:"Recevoir",swap:"Echanger",deposit:"Deposer",amount:"Montant",fee:"Frais",total:"Total",balance:"Solde",from_wallet:"Depuis le portefeuille",recipient:"Destinataire",account_number:"Numero de compte",bank:"Banque",provider:"Operateur",phone:"Numero de telephone",description:"Description",cancel:"Annuler",save:"Enregistrer",confirm:"Confirmer",copy:"Copier",close:"Fermer",back:"Retour",approve:"Approuver",reject:"Rejeter",success:"Succes",pending:"En attente",failed:"Echoue",processing:"En cours",verified:"Verifie",unverified:"Non verifie",active:"Actif",kyc_required:"Verification KYC requise",daily_limit:"Limite journaliere",complete_kyc:"Completez le KYC pour augmenter vos limites",two_fa:"Authentification a deux facteurs",enable_2fa:"Activer 2FA",disable_2fa:"Desactiver 2FA",export_csv:"Exporter CSV",download_receipt:"Telecharger le recu",print_receipt:"Imprimer le recu",transfer_initiated:"Transfert initie",copied:"Copie!",loading:"Chargement...",error:"Quelque chose s'est mal passe.",insufficient_balance:"Solde insuffisant",good_morning:"Bonjour",good_afternoon:"Bon apres-midi",good_evening:"Bonsoir",welcome_back:"Bon retour",terms:"Conditions d'utilisation",privacy:"Politique de confidentialite",logout:"Deconnexion",
  },
  pt: {
    dashboard:"Painel",wallets:"Carteiras",send_money:"Enviar Dinheiro",transactions:"Transacoes",fx_exchange:"Cambio de Moedas",payment_links:"Links de Pagamento",beneficiaries:"Beneficiarios",verification:"Verificacao",notifications:"Notificacoes",merchants:"Comerciantes",reports:"Relatorios",developer:"Desenvolvedor",admin_panel:"Painel Admin",compliance:"Conformidade",settings:"Configuracoes",activity_log:"Registro de Atividade",sign_in:"Entrar",sign_out:"Sair",create_account:"Criar Conta",email:"E-mail",password:"Senha",first_name:"Nome",last_name:"Sobrenome",country:"Pais",forgot_password:"Esqueceu a senha?",reset_password:"Redefinir senha",new_password:"Nova senha",current_password:"Senha atual",send_reset_link:"Enviar link",back_to_login:"Voltar ao login",send:"Enviar",receive:"Receber",swap:"Trocar",deposit:"Depositar",amount:"Valor",fee:"Taxa",total:"Total",balance:"Saldo",from_wallet:"Da carteira",recipient:"Destinatario",account_number:"Numero de conta",bank:"Banco",provider:"Operador",phone:"Numero de telefone",description:"Descricao",cancel:"Cancelar",save:"Guardar",confirm:"Confirmar",copy:"Copiar",close:"Fechar",back:"Voltar",approve:"Aprovar",reject:"Rejeitar",success:"Sucesso",pending:"Pendente",failed:"Falhou",processing:"Processando",verified:"Verificado",unverified:"Nao verificado",active:"Ativo",kyc_required:"Verificacao KYC necessaria",daily_limit:"Limite diario",complete_kyc:"Complete o KYC para aumentar seus limites",two_fa:"Autenticacao de Dois Fatores",enable_2fa:"Ativar 2FA",disable_2fa:"Desativar 2FA",export_csv:"Exportar CSV",download_receipt:"Baixar recibo",print_receipt:"Imprimir recibo",transfer_initiated:"Transferencia iniciada",copied:"Copiado!",loading:"Carregando...",error:"Algo deu errado.",insufficient_balance:"Saldo insuficiente",good_morning:"Bom dia",good_afternoon:"Boa tarde",good_evening:"Boa noite",welcome_back:"Bem-vindo de volta",terms:"Termos de Servico",privacy:"Politica de Privacidade",logout:"Sair",
  },
  ar: {
    dashboard:"لوحة التحكم",wallets:"المحافظ",send_money:"إرسال المال",transactions:"المعاملات",fx_exchange:"تبادل العملات",payment_links:"روابط الدفع",beneficiaries:"المستفيدون",verification:"التحقق",notifications:"الإشعارات",merchants:"التجار",reports:"التقارير",developer:"المطور",admin_panel:"لوحة الإدارة",compliance:"الامتثال",settings:"الإعدادات",activity_log:"سجل النشاط",sign_in:"تسجيل الدخول",sign_out:"تسجيل الخروج",create_account:"إنشاء حساب",email:"البريد الإلكتروني",password:"كلمة المرور",first_name:"الاسم الأول",last_name:"اسم العائلة",country:"الدولة",forgot_password:"نسيت كلمة المرور؟",reset_password:"إعادة تعيين",new_password:"كلمة المرور الجديدة",current_password:"كلمة المرور الحالية",send_reset_link:"إرسال الرابط",back_to_login:"العودة لتسجيل الدخول",send:"إرسال",receive:"استلام",swap:"تبادل",deposit:"إيداع",amount:"المبلغ",fee:"الرسوم",total:"المجموع",balance:"الرصيد",from_wallet:"من المحفظة",recipient:"المستلم",account_number:"رقم الحساب",bank:"البنك",provider:"المزود",phone:"رقم الهاتف",description:"الوصف",cancel:"إلغاء",save:"حفظ",confirm:"تأكيد",copy:"نسخ",close:"إغلاق",back:"رجوع",approve:"موافقة",reject:"رفض",success:"نجاح",pending:"معلق",failed:"فشل",processing:"جارٍ المعالجة",verified:"موثق",unverified:"غير موثق",active:"نشط",kyc_required:"مطلوب التحقق من الهوية",daily_limit:"الحد اليومي",complete_kyc:"أكمل التحقق لزيادة حدودك",two_fa:"المصادقة الثنائية",enable_2fa:"تفعيل المصادقة الثنائية",disable_2fa:"تعطيل المصادقة الثنائية",export_csv:"تصدير CSV",download_receipt:"تحميل الإيصال",print_receipt:"طباعة الإيصال",transfer_initiated:"تم بدء التحويل",copied:"تم النسخ!",loading:"جارٍ التحميل...",error:"حدث خطأ.",insufficient_balance:"رصيد غير كافٍ",good_morning:"صباح الخير",good_afternoon:"مساء الخير",good_evening:"مساء الخير",welcome_back:"مرحباً بعودتك",terms:"شروط الخدمة",privacy:"سياسة الخصوصية",logout:"تسجيل الخروج",
  },
  sw: {
    dashboard:"Dashibodi",wallets:"Pochi",send_money:"Tuma Pesa",transactions:"Miamala",fx_exchange:"Ubadilishanaji wa Fedha",payment_links:"Viungo vya Malipo",beneficiaries:"Wanufaika",verification:"Uthibitisho",notifications:"Arifa",merchants:"Wafanyabiashara",reports:"Ripoti",developer:"Msanidi",admin_panel:"Paneli ya Msimamizi",compliance:"Uzingatiaji",settings:"Mipangilio",activity_log:"Kumbukumbu za Shughuli",sign_in:"Ingia",sign_out:"Toka",create_account:"Fungua Akaunti",email:"Barua pepe",password:"Nywila",first_name:"Jina la kwanza",last_name:"Jina la ukoo",country:"Nchi",forgot_password:"Umesahau nywila?",reset_password:"Weka upya nywila",new_password:"Nywila mpya",current_password:"Nywila ya sasa",send_reset_link:"Tuma kiungo",back_to_login:"Rudi kwenye kuingia",send:"Tuma",receive:"Pokea",swap:"Badilisha",deposit:"Weka",amount:"Kiasi",fee:"Ada",total:"Jumla",balance:"Salio",from_wallet:"Kutoka pochi",recipient:"Mpokeaji",account_number:"Nambari ya akaunti",bank:"Benki",provider:"Mtoa huduma",phone:"Nambari ya simu",description:"Maelezo",cancel:"Ghairi",save:"Hifadhi",confirm:"Thibitisha",copy:"Nakili",close:"Funga",back:"Rudi",approve:"Idhinisha",reject:"Kataa",success:"Mafanikio",pending:"Inasubiri",failed:"Imeshindwa",processing:"Inachakatwa",verified:"Imethibitishwa",unverified:"Haijathibitishwa",active:"Amilifu",kyc_required:"Uthibitisho wa KYC unahitajika",daily_limit:"Kikomo cha kila siku",complete_kyc:"Kamilisha KYC kuongeza mipaka yako",two_fa:"Uthibitisho wa Hatua Mbili",enable_2fa:"Wezesha 2FA",disable_2fa:"Lemaza 2FA",export_csv:"Hamisha CSV",download_receipt:"Pakua risiti",print_receipt:"Chapisha risiti",transfer_initiated:"Uhamishaji umeanzishwa",copied:"Imenakiliwa!",loading:"Inapakia...",error:"Hitilafu imetokea.",insufficient_balance:"Salio haitoshi",good_morning:"Habari ya asubuhi",good_afternoon:"Habari ya mchana",good_evening:"Habari ya jioni",welcome_back:"Karibu tena",terms:"Masharti ya Huduma",privacy:"Sera ya Faragha",logout:"Ondoka",
  },
};

interface LangContextType {
  lang: string;
  setLang: (l: string) => void;
  t: (key: string) => string;
  languages: typeof LANGUAGES;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("iapay_lang") || "en");
  const setLang = (l: string) => {
    localStorage.setItem("iapay_lang", l);
    setLangState(l);
    document.documentElement.dir = LANGUAGES[l]?.rtl ? "rtl" : "ltr";
    document.documentElement.lang = l;
  };
  const t = (key: string) => T[lang]?.[key] || T.en[key] || key;
  return <LangContext.Provider value={{ lang, setLang, t, languages: LANGUAGES }}>{children}</LangContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useTranslation must be inside LangProvider");
  return ctx;
}

export function LanguageSwitcher({ style }: { style?: React.CSSProperties }) {
  const { lang, setLang, languages } = useTranslation();
  return (
    <select
      value={lang}
      onChange={e => setLang(e.target.value)}
      className="select"
      style={{ padding: "5px 10px", fontSize: 13, cursor: "pointer", minWidth: 120, ...style }}
    >
      {Object.entries(languages).map(([code, info]) => (
        <option key={code} value={code}>{info.flag} {info.label}</option>
      ))}
    </select>
  );
}
