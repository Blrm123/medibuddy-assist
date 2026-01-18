import { PageHeader } from "@/components/page-header"
import { Stethoscope } from "lucide-react"

export const metadata = {
    title: "Doctors Dashboard - MediBuddy",
    description: "Manage your appointments and availability - MediBuddy",
}

const DoctorDashboardLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div>
            <PageHeader title="Doctors Dashboard" icon={<Stethoscope />} />
            {children}
        </div>
    )
}

export default DoctorDashboardLayout;