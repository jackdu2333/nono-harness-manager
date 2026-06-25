import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('app_language', newLang);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0 p-6">
        <div className="max-w-2xl w-full mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
          
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-foreground">Language / 语言</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose your preferred interface language
                  </p>
                </div>
                <Button variant="outline" onClick={toggleLanguage} className="bg-background border-border text-foreground hover:bg-accent">
                  {i18n.language === 'en' ? 'English (EN)' : '中文 (ZH)'}

                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
