import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Créez votre compte</CardTitle>
          <CardDescription>
            Entrez vos informations pour créer un nouveau compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Nom utilisateur</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="Nom d'utilisateur"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                </div>
                <Input id="password" type="password" required />
              </Field>
              <Field>
                <Button className="bg-linear-to-r from-purple-700 to-orange-500" type="submit">Créer un compte</Button>

                <FieldDescription className="text-center">
                  Vous avez déjà un compte? 
                  <Link href="/login"> Se connecter</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
