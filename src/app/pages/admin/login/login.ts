import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly error = signal('');
  readonly loading = signal(false);
  readonly timedOut = signal(this.route.snapshot.queryParamMap.get('reason') === 'timeout');

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      const credential = await this.auth.signIn(this.email, this.password);
      const { claims } = await credential.user.getIdTokenResult();
      if (claims['admin'] !== true) {
        await this.auth.signOut();
        this.error.set('This account does not have admin access.');
        return;
      }
      await this.router.navigate(['/admin']);
    } catch {
      this.error.set('Invalid email or password.');
    } finally {
      this.loading.set(false);
    }
  }
}
