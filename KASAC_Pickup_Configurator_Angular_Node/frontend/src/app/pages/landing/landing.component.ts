import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMMERCIAL_ENABLED } from '../../app.variant';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  readonly commercialEnabled = COMMERCIAL_ENABLED;
  readonly contactUrl = 'https://www.kasac.pe/contacto';
  readonly year = new Date().getFullYear();
  photoMissing = false;
}
